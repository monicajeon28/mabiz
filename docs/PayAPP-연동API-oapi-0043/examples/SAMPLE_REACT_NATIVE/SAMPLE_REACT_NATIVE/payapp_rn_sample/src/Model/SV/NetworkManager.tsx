import axios from 'axios';
import {ConstValue} from '~/Define/ConstValue';

// 요청
export const request = (mothod: string, params: Object) => {
    let options = {
        method: mothod,
        url: ConstValue.BASE_URL,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json;'
        },
        params: params
                 
    };
    return axios(options);  
}