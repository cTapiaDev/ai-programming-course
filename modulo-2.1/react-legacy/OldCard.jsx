import React from 'react';
class OldCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { likes: 0 };
    this.handleLike = this.handleLike.bind(this);
  }
  handleLike() { this.setState({ likes: this.state.likes + 1 }); }
  render() {
    return <button onClick={this.handleLike}>Likes: {this.state.likes}</button>;
  }
}
export default OldCard;