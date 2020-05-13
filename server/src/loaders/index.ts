import { Application } from 'express';
import expressLoader from './express';
import dependencyInjectorLoader from './dependencyInjector';
import Logger from './logger';
import mongooseLoader from './mongoose';

export default async ({ expressApp }: { expressApp: Application }) => {
  await mongooseLoader();
  Logger.info('DB loaded and connected!');

  const productModel = {
    name: 'productModel',
    model: require('../models/product').default,
  };

  const userModel = {
    name: 'userModel',
    model: require('../models/user').default,
  }

  await dependencyInjectorLoader({
    models: [productModel, userModel],
  });
  Logger.info('Dependency Injector loaded');

  await expressLoader({ app: expressApp });
  Logger.info('Express Intialized');
};
