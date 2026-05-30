import React, {useContext, useState, useEffect} from 'react';
import {WebView} from 'react-native-webview';
import {ConstValue} from '~/Define/ConstValue';
import {Linking, Platform} from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';
import Toast from 'react-native-simple-toast';

/**
 * 해당 앱은 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 * 
 */
const WebToAppScreen = () => {
  const isAndroid = Platform.OS === 'android';

  const onShouldStartLoadWithRequest = (event) => {            
    if (
      event.url.startsWith('file') || 
      event.url.startsWith('about:blank')
    ) {      
      return true;
    }

    if (event.url.startsWith(ConstValue.DEEP_LINK)) {   
        openApp(event.url);
        return false;
    }
  
  };


  const openApp = (param: string) => {

    Linking.canOpenURL(param).then(supported => {
      if (supported) {
          Linking.openURL(param);
      } else {
        Linking.openURL(Platform.OS === 'ios' ? ConstValue.PAYAPP_iOS_STORE : ConstValue.PAYAPP_AOS_STORE);
      }
    });
  };


  return (
    <WebView
      source={{uri: (isAndroid ? 'file:///android_asset/' : '') + 'index.html'}}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}        
    />
  );
};

export default WebToAppScreen;