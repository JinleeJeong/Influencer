import React from 'react';
import Card from 'components/Swiper/Card';
import CardWrapper from 'components/Swiper/CardWrapper';

const Swiper: React.FC = () => {
  function renderCards(): object {
    const cardInfo = ['First', 'Second', 'Third', 'Fourth'];
    return cardInfo.map((data, index) => (
      <Card
        key={index}>
        {data} Hello World!
      </Card>
    ));
  }

  return (
    <CardWrapper>
      {renderCards()}
    </CardWrapper>
  );
};

export default Swiper;
