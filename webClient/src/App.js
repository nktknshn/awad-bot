import React from 'react';
import PostCreate from './PostCreate'
import PostList from './PostList'

export default () => {
  return ( 
  <div className = "container" >
    <h1> Create a Card </h1> 
    <CardCreate / >
    <hr/>
    <h1> My Cards </h1> 
    <section className="cardList">
    <CardList / >
    </section>
  </div>

  );
};