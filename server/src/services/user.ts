import { Service, Inject, ContainerInstance } from 'typedi'
import { Model, Document } from 'mongoose';
import winston from 'winston';
import { IUser, IProduct, Prefer, IProductDTO, RecommenderResult } from '../interfaces';
import config from '../config';
const ContentBasedRecommender = require('content-based-recommender');
import {
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../modules/errors';

@Service()
export default class UserService {
  private userModel: Model<IUser & Document>;
  private productModel: Model<IProduct & Document>;
  private logger: winston.Logger;

  constructor(@Inject() container: ContainerInstance) {
    this.userModel = container.get('userModel');
    this.productModel = container.get('productModel');
    this.logger = container.get('logger');
  }

  /**
   * @param productNo 
   * @param weight 
   */
  public async addWeight(
    productNo: number,
    weight: number
  ): Promise<any> {

    const selectProduct = (
      productNo: number,
      weight: number
    ): Promise<any> => {

      return new Promise(async (resolve, reject) => {
        const productRecord = await this.productModel.findOne({ productNo: productNo });
        if (!productRecord) {
          reject('Product is not exist');
        }
        resolve({ productNo, productRecord, weight });
      });
    };

    const selectUser = (
      { productNo, productRecord, weight }: any
    ): Promise<any> => {

      return new Promise(async (resolve, reject) => {
        const userRecord = await this.userModel.findOne({ userName: config.personaName });
        if (!userRecord) {
          reject('User is not exist');
        }
        resolve({ productNo, productRecord, userRecord, weight });
      });
    };

    const checkExist = (
      { productNo, productRecord, userRecord, weight }: any
    ): Promise<any> => {

      return new Promise(async (resolve, reject) => {
        let products = productRecord.toObject();
        let users = userRecord.toObject();

        const idx = users.prefer.findIndex((p: any, i: any) => {
          p.productNo === productNo;
          return i;
        });

        resolve({ userRecord, products, users, idx, weight });
      });
    };

    const addWeight = async ({ userRecord, products, users, idx, weight }: any) => {
      if (idx < 0) {
        const result = await userRecord.update({
          $push: {
            prefer: {
              productNo: products.productNo,
              categoryId: products.category.categoryId,
              rating: weight
            }
          }
        });

        return result
      }

      if (users.prefer[idx].rating + weight <= 5) {
        users.prefer[idx].rating += weight;

        const result = await userRecord.update({
          prefer: users.prefer
        });
        return result;

      }

      users.prefer[idx].rating = 5.0;
      const result = await userRecord.update({
        prefer: users.prefer
      });
      return result;
    };

    const handleClicklogError = (e: Error) => {
      this.logger.error(e);
      throw e;
    };

    return await
      selectProduct(productNo, weight)
        .then(selectUser)
        .then(checkExist)
        .then(addWeight)
        .catch(handleClicklogError);
  }

  /**
   * 
   * @param productNo 
   */
  public async clickLog(
    productNo: number
  ): Promise<any> {

    return await this.addWeight(productNo, config.clicklogWeight);
  }

  /**
   * 
   * @param productNo 
   * @param exist 
   */
  public async setLike(
    productNo: number,
    wholeCategoryId: Array<string>,
    exist: boolean
  ): Promise<any> {

    const userRecord = await this.userModel.findOne({ userName: config.personaName });
    const productRecord = await this.productModel.findOne({ productNo: productNo })

    if (!userRecord) throw new NotFoundError('User is not exist');
    if (!productRecord) throw new NotFoundError('Product is not exist');

    let users = userRecord.toObject();

    try {

      if (exist) {
        users.like[wholeCategoryId[0]].likeList =
          users.like[wholeCategoryId[0]].likeList.filter((l: number) => (l !== productNo));

        userRecord.like = users.like
        return await userRecord.save();
      }

      users.like[wholeCategoryId[0]].likeList.push(productNo);

      userRecord.like = users.like;
      await userRecord.save();

    } catch (e) {
      this.logger.error(e);
      throw e;
    }

    return await this.addWeight(productNo, config.likeWeight);
  }

  public async selectLikeList(
    page: number
  ): Promise<any> {
    const userLikeRecord =
      await this.userModel
        .findOne({ userName: config.personaName })
        .select('-prefer -updatedAt -createdAt -userName -_id');

    if (!userLikeRecord) throw new NotFoundError('User is not exist');

    try {
      const users = userLikeRecord.toObject();
      let result: { [index: string]: Object } = {};

      for (let categoryId of Object.keys(users.like)) {
        if (users.like[categoryId].likeList.length < 1) {
          result[users.like[categoryId].categoryName] = [];

        } else {
          const productList = [];

          for (let like of users.like[categoryId].likeList.slice(page * 10, page * 10 + 10)) {
            const product =
              await this.productModel
                .findOne({ productNo: like })
                .select('productNo name productImages category salePrice saleStartDate')
            productList.push(product);
          }

          result[users.like[categoryId].categoryName] = productList;
        }
      }
      return result;

    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  public async recommendItem(
    page: number
  ): Promise<any> {

    const userRecord = await this.userModel.find();

    if (!userRecord) throw new NotFoundError('User is not exist!');

    const recommender = new ContentBasedRecommender({
      minScore: 0.1,
      maxSimilarDocuments: 100
    });

    const addRemainder = async (remainder: number, result: Array<IProductDTO>) => {
      const filtering = result.map((r: any) => r.productNo);
      const productRecord =
        await this.productModel.find()
          .where('productNo').nin(filtering)
          .select('-_id name category productNo salePrice productImages productInfoProvidedNoticeView')
          .limit(remainder);

      result.push(...productRecord);
      return result;
    };

    try {
      userRecord.forEach((user: IUser) => (user.prefer.sort((a: Prefer, b: Prefer) => b.rating - a.rating)));

      const documents = userRecord.map((user: IUser) => ({ id: user.userName, content: user.prefer }));

      recommender.train(documents)
      const collaborators = recommender.getSimilarDocuments(config.personaName, 0, 10);
      collaborators.sort((a: RecommenderResult, b: RecommenderResult) => b.score - a.score);

      const result: Array<IProductDTO> = [];
      if (collaborators.length <= page) return await addRemainder(10, result);

      const similarData = collaborators[page];
      const similarRecord = await this.userModel.findOne().where('userName').equals(similarData.id);

      if (!similarRecord) throw new NotFoundError('Similar is not exist!');

      for (const preference of similarRecord.prefer) {
        const productRecord =
          await this.productModel.findOne()
            .where('productNo').equals(preference.productNo)
            .select('-_id name category productNo salePrice productImages productInfoProvidedNoticeView');

        if (!productRecord) throw new NotFoundError('User is not exist!');

        result.push(productRecord);
      }

      const remainder = 10 - result.length;

      if (remainder) return await addRemainder(remainder, result);
      return result;

    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}