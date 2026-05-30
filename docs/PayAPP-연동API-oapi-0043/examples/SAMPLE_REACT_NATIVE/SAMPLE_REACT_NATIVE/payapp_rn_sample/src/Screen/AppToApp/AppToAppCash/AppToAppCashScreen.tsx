import React, { useContext, useState, useEffect } from 'react';
import {
  Container,
  VContainer,
  VStack,
  HStack,
  TextInput,
  Text,
  RedText,
  SmallButton,
  ButtonTitle,
} from '~/Components/PAStyle';
import { Alert, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Styled from 'styled-components/native';
import { AppToAppCashContext } from '~/Screen/AppToApp/AppToAppCash/AppToAppCashContextProvider';
import CashReceiptCancelModal from '~/Screen/Modal/CashReceiptCancelModal';

const RadioButton = Styled.TouchableOpacity`
  flex-direction: row;  
  height: 30px;
  margin: 2%;
  align-items: center;
  justify-content: flex-start;
`;

const RadioImage = Styled.Image`
  width: 30px;
  height: 30px;
`;

/**
 * 해당 앱은 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 */
const AppToAppCashScreen = () => {
  const {
    trCode,
    setTrCode,
    tradeTime,
    setTradeTime,
    idInfo,
    setIdInfo,
    name,
    setName,
    goodName,
    setGoodName,
    goodPrice,
    setGoodPrice,
    useTax,
    setUseTax,
    svc,
    setSvc,
    email,
    setEmail,
    var1,
    setVar1,
    var2,
    setVar2,
    reset,
    cashReceipt,
    visibleCashReceiptCancelModal,
    setVisibleCashReceiptCancelModal,
  } = useContext(AppToAppCashContext);

  const showAlert = (message: string) => {
    Alert.alert('알림', message, [{ text: '확인' }]);
  };

  useEffect(() => {
    reset();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Container>
        <VContainer>
          <Modal
            animationType="slide"
            visible={visibleCashReceiptCancelModal}
            transparent={true}>
            <CashReceiptCancelModal />
          </Modal>

          <VStack>
            <HStack>
              <Text style={{ width: 100 }}>용도 (필수)</Text>

              <RadioButton
                onPress={() => {
                  setTrCode(true);
                }}>
                <RadioImage
                  source={
                    trCode
                      ? require('~/Assets/Image/radio_on.png')
                      : require('~/Assets/Image/radio_off.png')
                  }
                />

                <Text>소득공제용</Text>
              </RadioButton>

              <RadioButton
                onPress={() => {
                  setTrCode(false);
                }}>
                <RadioImage
                  source={
                    !trCode
                      ? require('~/Assets/Image/radio_on.png')
                      : require('~/Assets/Image/radio_off.png')
                  }
                />

                <Text>지출증빙용</Text>
              </RadioButton>
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>원거래시간 (필수)</Text>
              <TextInput onChangeText={value => setTradeTime(value)} value={tradeTime} keyboardType="numeric" />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>발행번호 (필수)</Text>
              <TextInput onChangeText={value => setIdInfo(value)} value={idInfo} keyboardType="numeric" />
            </HStack>
            <HStack>
              <Text style={{ width: 100 }}></Text>
              <RedText>* 소득공제: 휴대폰번호, 지출증빙: 사업자번호</RedText>
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>구매자명 (필수)</Text>
              <TextInput onChangeText={value => setName(value)} value={name} />
            </HStack>
            <HStack>
              <Text style={{ width: 100 }}></Text>
              <RedText>* 소득공제: 구매자명, 지출증빙: 사업자명</RedText>
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>상품명 (필수)</Text>
              <TextInput onChangeText={value => setGoodName(value)} value={goodName} />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>거래금액 (필수)</Text>
              <TextInput onChangeText={value => setGoodPrice(value)} value={goodPrice} keyboardType="numeric" />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>부가세 (필수)</Text>

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
          </VStack>
        </VContainer>


        <VContainer>
          <VStack>

            <HStack>
              <Text style={{ width: 100 }}>봉사료</Text>
              <TextInput onChangeText={value => setSvc(value)} value={svc} keyboardType="numeric" />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>구매자 E-Mail</Text>
              <TextInput onChangeText={value => setEmail(value)} value={email} />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>var1 (Option)</Text>
              <TextInput onChangeText={value => setVar1(value)} value={var1} />
            </HStack>


            <HStack>
              <Text style={{ width: 100 }}>var2 (Option)</Text>
              <TextInput onChangeText={value => setVar2(value)} value={var2} />
            </HStack>
          </VStack>
        </VContainer>

        <VStack>
          <HStack>
            <SmallButton
              onPress={() => {
                setVisibleCashReceiptCancelModal(true)
              }}>
              <ButtonTitle>영수증 취소</ButtonTitle>
            </SmallButton>

            <SmallButton
              onPress={() => {
                cashReceipt();
              }}>
              <ButtonTitle>영수증 발행</ButtonTitle>
            </SmallButton>
          </HStack>
        </VStack>
      </Container>
    </TouchableWithoutFeedback>
  );
};

export default AppToAppCashScreen;
