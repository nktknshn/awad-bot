import React, {useState, useEffect} from 'react';
import CommentCreate from './CommentCreate';
import axios from 'axios';
import CommentList from './CommentList';

export default () => {
  const [posts, setPosts] = useState({});
  const fetchPosts = async () => {
    const res = await axios.get('');

    setPosts(res.data);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const renderedPosts = Object.values(posts).map(post => {
    return ( 
    <div className = "card"
      style = {
        { width: '30%',marginBottom: '20px'}} key = {post.id}>

      <div className = "card-body" >
      <h3> {post.title} </h3> 
      <CommentList postId={post.id} />
      <CommentCreate postId = {post.id}/> 
      </div>
      </div>
    );
  });
  return<> <div className = "d-flex flex-row flex-wrap justify-content-between" > 
  {/* {renderedPosts}  */}</div>
  

  <section class="cardList">

      <dl class="card">
        <ol>
          <li></li><li></li><li></li>
        </ol>


        <dt class="word">diligence</dt>
        <dd>
          <ol>
            <li><p>/ˈdɪlɪdʒ(ə)ns/</p><button>icon</button></li>
            <li><p>careful and persistent work or effort.</p></li>
            <li>
              <ul>
              
                <li><p>example1</p></li>
                <li><p>example1</p></li>
              </ul>
            </li>
            <li>
              <p>tag1</p><p>tag2</p>
            </li>
          </ol>
        </dd>

      </dl>
    </section></>
  
}