import React, {
  useState
} from 'react'
import axios from 'axios';

export default ({postId}) => {

  const [content, setContent] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();

    await axios.post(``, {
      content
    });

    setContent('');

  };
  return ( 
  <div>
      <form onSubmit = { onSubmit} >
      <div className = "form-group" >

      <label > NewComment </label>  

      <input 
        value = {content }
        onChange = { e => setContent(e.target.value) }
        className = "form-control" 
      />

      </div> 
      < button className = "btn btn-primary g" > submit </button> 
      </form>

      </div> )
      };