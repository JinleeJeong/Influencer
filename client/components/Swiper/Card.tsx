import React, { useState } from 'react';
import useStyles from 'components/Swiper/styles';
import Hammer from 'react-hammerjs';
import clsx from 'clsx';

const Card: React.FC = (props) => {
  const { children } = props;
  const classes = useStyles(props);
  const [offset, setOffset] = useState([0, 0]);
  const [rotation, setRotation] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  function handlePan(event): void {
    setIsMoving(true);
    setOffset([event.deltaX, event.deltaY]);
    setRotation((event.deltaX * 0.03) * (event.deltaY / 80));
  }

  function handlePanEnd(event): void {
    let moveOutWidth = 0;
    let keep = false;
    let [endX, toX, endY, toY] = [0, 0, 0, 0];
    setIsMoving(false);
    keep = Math.abs(event.deltaX) < 300;
    if (keep) {
      event.target.style.transform = '';
    } else {
      moveOutWidth = document.body.clientWidth;
      endX = event.velocityX > 1 ? Math.abs(event.velocityX) * moveOutWidth : moveOutWidth;
      toX = event.deltaX > 0 ? endX : -endX;
      endY = Math.abs(event.velocityY) * moveOutWidth;
      toY = event.deltaY > 0 ? endY : -endY;
      setOffset([toX, toY + event.deltaY]);
      setRotation((event.deltaX * 0.03) * (event.deltaY / 80));
    }
  }

  function handleDoubleTap(): void {
    // alert('You Liked this Product!');
    setOffset([0, -(document.body.clientWidth * 0.3) - 100]);
    setRotation(80);
  }

  return (
    <Hammer
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onDoubleTap={handleDoubleTap}
    >
      <div
        className={clsx(classes.card, isMoving && classes.card_moving)}
        style={{
          transform: `translate(${offset[0]}px, ${offset[1]}px) rotate(${rotation}deg)`,
        }}>
        {children}
      </div>
    </Hammer>
  );
};

export default Card;
