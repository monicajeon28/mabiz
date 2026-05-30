import React, { useContext, useState, useEffect } from 'react';
import {
  Container,
  VContainer,
  HContainer,
  VStack,
  HStack,
  TextInput,
  Text,
  RedText,
  Button,
  SmallButton,
  ButtonTitle,
} from '~/Components/PAStyle';
import { Platform, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Styled from 'styled-components/native';
import { AppToAppPayContext } from '~/Screen/AppToApp/AppToAppPayment/AppToAppPayContextProvider';

const RadioButton = Styled.TouchableOpacity`
  flex-direction: row;
  width: 50px;
  height: 30px;
  margin: 2%;
  align-items: center;
  justify-content: center;
`;

const RadioImage = Styled.Image`
  width: 30px;
  height: 30px;
`;

/**
 * 해당 앱은 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 */
const AppToAppPayScreen = () => {
  const {
    reset,
    customerPhone,
    setCustomerPhone,
    goodName,
    setGoodName,
    price,
    setPrice,
    useTax,
    setUseTax,
    isAllPayReqType,
    setIsAllPayReqType,
    var1,
    setVar1,
    var2,
    setVar2,
    payRequest
  } = useContext(AppToAppPayContext);

  const showAlert = (message: string) => {
    Alert.alert('알림', message, [{ text: '확인' }]);
  };

  useEffect(() => {
    return () => {
      reset()
    };
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}
      accessible={false}>
      <Container>
        <VContainer>
          <HStack>
            <TextInput
              placeholder="고객 전화번호"
              onChangeText={value => setCustomerPhone(value)}
              // value={customerPhone}
              keyboardType="numeric"
            />
          </HStack>

          <RedText>* 휴대번호는 010으로 시작해야 합니다.</RedText>
        </VContainer>

        <VContainer>
          <HStack>
            <TextInput
              placeholder="상품명"
              onChangeText={value => setGoodName(value)}
              value={goodName}
            />

            <TextInput
              placeholder="가격"
              onChangeText={value => setPrice(value)}
              value={price}
              keyboardType="numeric"
            />

            <Text>원</Text>
          </HStack>
        </VContainer>

        <VContainer>
          <HStack>
            <RadioButton
              onPress={() => {
                setUseTax(true);
              }}>
              <RadioImage
                source={
                  useTax
                    ? require('~/Assets/Image/radio_on.png')
                    : require('~/Assets/Image/radio_off.png')
                }
              />

              <Text>과세</Text>
            </RadioButton>

            <RadioButton
              onPress={() => {
                setUseTax(false);
              }}>
              <RadioImage
                source={
                  !useTax
                    ? require('~/Assets/Image/radio_on.png')
                    : require('~/Assets/Image/radio_off.png')
                }
              />

              <Text>면세</Text>
            </RadioButton>
          </HStack>

          <RedText>* 개인의 경우 면세로 요청해야 합니다.</RedText>
        </VContainer>



        <VContainer>

          <Text>모든 결제타입 사용여부</Text>

          <HStack>
            <RadioButton
              onPress={() => {
                setIsAllPayReqType(true);
              }}>
              <RadioImage
                source={
                  isAllPayReqType
                    ? require('~/Assets/Image/radio_on.png')
                    : require('~/Assets/Image/radio_off.png')
                }
              />

              <Text>사용</Text>
            </RadioButton>

            <RadioButton
              onPress={() => {
                setIsAllPayReqType(false);
              }}>
              <RadioImage
                source={
                  !isAllPayReqType
                    ? require('~/Assets/Image/radio_on.png')
                    : require('~/Assets/Image/radio_off.png')
                }
              />

              <Text>미사용</Text>
            </RadioButton>
          </HStack>

        </VContainer>



        <VContainer>
          <HStack>
            <Text style={{ width: 100 }}>var1 (Option)</Text>
            <TextInput onChangeText={value => setVar1(value)} value={var1} />
          </HStack>

          <HStack>
            <Text style={{ width: 100 }}>var2 (Option)</Text>
            <TextInput onChangeText={value => setVar2(value)} value={var2} />
          </HStack>
        </VContainer>

        <VStack>
          <HStack>
            <SmallButton
              onPress={() => {
                payRequest('REMOTE');
              }}>
              <ButtonTitle>원격결제</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('MANUAL');
              }}>
              <ButtonTitle>수기결제</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('OCR');
              }}>
              <ButtonTitle>카메라결제</ButtonTitle>
            </SmallButton>
          </HStack>

          <HStack>
            <SmallButton
              onPress={() => {
                payRequest('APPLE_PAY');
              }}>
              <ButtonTitle>애플</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('NAVER_PAY');
              }}>
              <ButtonTitle>네이버</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('KAKAO_PAY');
              }}>
              <ButtonTitle>카카오</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('SMILE_PAY');
              }}>
              <ButtonTitle>스마일</ButtonTitle>
            </SmallButton>
          </HStack>

          <HStack>
            <SmallButton
              onPress={() => {
                payRequest('WECHAT_PAY');
              }}>
              <ButtonTitle>위챗</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('PAYCO');
              }}>
              <ButtonTitle>페이코</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('MY_ACCOUNT');
              }}>
              <ButtonTitle>내통장결제</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                payRequest('TOSS_PAY');
              }}>
              <ButtonTitle>토스페이</ButtonTitle>
            </SmallButton>
          </HStack>

          <HStack>
            <SmallButton
              onPress={() => {
                payRequest('QR');
              }}>
              <ButtonTitle>QR</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                if (Platform.OS == 'ios') {
                  showAlert('안드로이드만 이용 가능합니다.');
                } else if (Platform.OS == 'android') {
                  payRequest('NFC');
                }
              }}>
              <ButtonTitle>NFC결제(카드)</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                if (Platform.OS == 'ios') {
                  showAlert('안드로이드만 이용 가능합니다.');
                } else if (Platform.OS == 'android') {
                  payRequest('SAMSUNG');
                }
              }}>
              <ButtonTitle>NFC결제(삼성페이)</ButtonTitle>
            </SmallButton>
          </HStack>
        </VStack>
      </Container>
    </TouchableWithoutFeedback>
  );
};

export default AppToAppPayScreen;
