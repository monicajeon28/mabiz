/**
 * Payapp React-Native 샘플
 * @format
 */

import React, { useEffect, useState } from 'react';
import { Linking, Modal, SafeAreaView } from 'react-native';
import Navigator from './Screen/Navigator';
import {
  ModalContainer,
  TitleText,
  Text,
  HStack,
  SmallButton,
  SafeAreaContainer
} from '~/Components/PAStyle';

import Styled from 'styled-components/native';
export const AppToAppResultText = Styled.Text`
  width: 100%;
  font-size: 14px;   
  margin: 1px;
  padding-top: 20px;
  padding-left: 20px;
  padding-right: 20px;
`;

/*************************************************************************************************
 * 해당 샘플은 참고용 가이드앱입니다
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 *************************************************************************************************/



/*
  AppToApp 이용 시 설정

  ** iOS **
  - Project Setting 
    ┖ URL Types - URL Schemes 추가

  - AppDelegate.m
    ┖ #import <React/RCTLinkingManager.h>
    ┖ (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
  

  ** AOS **
  - AndroidManifest.xml
    ┖ <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:host="result" android:scheme="payappSampleRN" />
*/


const App = () => {
  const [visibleAlert, setVisibleAlert] = useState(false);
  const [appToAppResult, setAppToAppResult] = useState('');
  // AppToApp 결과값
  const addListenerLink = ({ url }) => {
    console.log('@@@@ url ' + url)
    if (null != url) {
      var regex = /[?&]([^=#]+)=([^&#]*)/g,
        params = {},
        match;

      var result = "";
      while (match = regex.exec(url)) {
        result += match[1] + ' = ' + decodeURIComponent(match[2]) + '\n';
        params[match[1]] = decodeURIComponent(match[2]);
      }
      console.log('result ' + result);

      setAppToAppResult(result);
      setVisibleAlert(true);
    }
  };



  // AppToApp Scheme 통신 설정
  useEffect(() => {

    Linking.addEventListener('url', addListenerLink);
    return () => {
      try {
        Linking.removeEventListener('url', addListenerLink)
      } catch (error) {
        console.log(error)
      }
    };
  },);

  return (
    <>
      <Navigator />

      <Modal // Result Alert
        visible={visibleAlert}
        transparent={true}>
        <SafeAreaView style={SafeAreaContainer}>
          <ModalContainer>
            <TitleText>APP TO APP 결과</TitleText>

            <AppToAppResultText>{appToAppResult}</AppToAppResultText>

            <HStack>
              <SmallButton
                onPress={() => {
                  setAppToAppResult('');
                  setVisibleAlert(false)
                }}>
                <Text>확인</Text>
              </SmallButton>
            </HStack>
          </ModalContainer>
        </SafeAreaView>
      </Modal>
    </>
  )
};

export default App;