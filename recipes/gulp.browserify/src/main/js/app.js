require('./globals');

import React from 'react';

let HelloMessage = React.createClass({
	render: function(){
		return <div>Hello {this.props.name}</div>
	}
})

ReactDOM.render(<HelloMessage name="react"/>, document.getElementById('content'));