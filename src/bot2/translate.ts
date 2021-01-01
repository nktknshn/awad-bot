import axios from 'axios'
import { v4 } from 'uuid'
import tokens from "../telegram-token.json"

const subscriptionKey = (tokens as any).translatorKey
const endpoint = "https://api.cognitive.microsofttranslator.com"

const translate = async () => {

    return axios({
        baseURL: endpoint,
        url: '/translate',
        method: 'post',
        headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Ocp-Apim-Subscription-Region': "switzerlandwest",
            'Content-type': 'application/json',
            'X-ClientTraceId': v4().toString()
        },
        params: {
            'api-version': '3.0',
            'from': 'en',
            'to': ['ru']
        },
        data: [{
            'text': 'Hello World!'
        }],
        responseType: 'json'
    }).then(function (response) {
        console.log(JSON.stringify(response.data, null, 4));
    })
}

const lookupDictionary = async () => {

    return axios({
        baseURL: endpoint,
        url: '/dictionary/lookup',
        method: 'post',
        headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Ocp-Apim-Subscription-Region': "switzerlandwest",
            'Content-type': 'application/json',
            'X-ClientTraceId': v4().toString()
        },
        params: {
            'api-version': '3.0',
            'from': 'en',
            'to': ['ru']
        },
        data: [{
            'text': 'top it off'
        }],
        responseType: 'json'
    }).then(function (response) {
        console.log(JSON.stringify(response.data, null, 4));
    })
}

lookupDictionary()