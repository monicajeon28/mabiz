import React, {useContext, useState, useEffect} from 'react';
import {Container, ButtonTitle} from '~/Components/PAStyle';
import Styled from 'styled-components/native';
import {WebView} from 'react-native-webview';
import {OApiContext} from '~/Screen/OApi/OApiContextProvider';
import SendIntentAndroid from 'react-native-send-intent';
import {Linking, Platform} from 'react-native';
import Toast from 'react-native-simple-toast';

const BackButton = Styled.TouchableOpacity`  
  height: 60px;    
  margin: 3px;
  align-items: center;
  justifyContent: center;
  borderRadius: 1px;
  borderColor:#aaaaaa;
  borderWidth: 1px;
`;

  /**
  * WebView 샘플입니다.
  * 앱제작사의 용도에 맞게 WebView를 새로 만들어 커스텀하세요.
  */

const WebViewScreen = ({route}) => {
  let {url} = route.params;

  const onShouldStartLoadWithRequest = event => {
    if (
      event.url.startsWith('http://') ||
      event.url.startsWith('https://') ||
      event.url.startsWith('about:blank')
    ) {
      return true;
    }
    
    if (Platform.OS === 'android') {      
      SendIntentAndroid.openAppWithUri(event.url)
        .then(isOpened => {
          if (!isOpened) {                                  
            // 비씨카드
            if (event.url.startsWith('ispmobile://')) {
              Linking.openURL('http://mobile.vpay.co.kr/jsp/MISP/andown.jsp')        
              return false;
            }
            
            Toast.show('앱 실행에 실패했습니다.', Toast.SHORT);             
          }
        })
        .catch(err => {
          Toast.show('Error : ' + err, Toast.SHORT);          
        });
      return false;
    } else {      
      Linking.openURL(event.url).catch(err => {        
        Toast.show(
          '앱 실행을 실패했습니다. 설치가 되어있지 않은 경우 설치하기 버튼을 눌러주세요.',
          Toast.SHORT,
        );
      });
      return false;
    }
  };

  useEffect(() => {});

  return (
    <WebView
      source={{uri: url}}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}      
    />
  );
};

export default WebViewScreen;
