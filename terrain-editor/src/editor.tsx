declare global {
    interface Window {
        require: any;
        test: any;
    }
}

import {Editor} from './components/editor';

import * as React from 'react';
import * as ReactDOM from 'react-dom';



ReactDOM.render(<Editor/>, document.getElementById('app'));