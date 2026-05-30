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
  ButtonTitle,
} from '~/Components/PAStyle';
import { Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Styled from 'styled-components/native';
import { OApiContext } from '~/Screen/OApi/OApiContextProvider';

import BillRegisterModal from '~/Screen/Modal/BillRegisterModal';
import BillListModal from '~/Screen/Modal/BillListModal';

const OApiButton = Styled.TouchableOpacity`  
  height: 60px;    
  margin: 3px;
  align-items: center;
  justifyContent: center;
  borderRadius: 1px;
  borderColor:#aaaaaa;
  borderWidth: 1px;
`;

const ScrollView = Styled.ScrollView`
  width: 100%;
`;

const BackButton = Styled.TouchableOpacity`  
  bottom: 20;
  left: 20;
  width: 30; 
  backgroundColor: #ebb948;
  paddingVertical: 2;
  borderRadius: 50;
`;

/**
 * 해당 앱은 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 */
const OApiScreen = ({ navigation }) => {
  const {
    reset,
    userId,
    setUserID,
    linkKey,
    setLinkKey,
    recvphone,
    setRecvPhone,
    email,
    setEmail,
    rebillExpire,
    setRebillExpire,
    visibleRegisterModal,
    setVisibleRegisterModal,
    visibleListModal,
    setVisibleListModal,
    payReqeust,
    payCancel,
    payCancelReq,
    rebillRegist,
    rebillCancel,
    rebillStop,
    rebillStart,
    sellerRegist,
    useridCheck,
    subidRegist,
    cashStRegist,
    cashStCancel,
    checkNpayCashReceiptReq,
  } = useContext(OApiContext);

  useEffect(() => {
    return () => {
      reset()
    };
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Container>
        <VContainer>
          <Modal
            animationType="slide"
            visible={visibleRegisterModal}
            transparent={true}>
            <BillRegisterModal />
          </Modal>

          <Modal
            animationType="slide"
            visible={visibleListModal}
            transparent={true}>
            <BillListModal />
          </Modal>

          <HStack>
            <Text style={{ width: 110 }}>판매자 아이디</Text>
            <TextInput onChangeText={value => setUserID(value)} value={userId} />
          </HStack>

          <HStack>
            <Text style={{ width: 110 }}>연동 키(취소)</Text>
            <TextInput
              onChangeText={value => setLinkKey(value)}
              value={linkKey}
            />
            <OApiButton
              onPress={() => {
                navigation.navigate('WebViewScreen', { 'url': 'https://seller.payapp.kr/c/apiconnect_info' });
              }}
              style={{ width: 70, height: 35 }}>
              <ButtonTitle>가져오기</ButtonTitle>
            </OApiButton>
          </HStack>

          <HStack>
            <Text style={{ width: 110 }}>고객전화번호</Text>
            <TextInput
              onChangeText={value => setRecvPhone(value)}
              value={recvphone}
              keyboardType="numeric"
            />
          </HStack>

          <HStack>
            <Text style={{ width: 110 }}>이메일</Text>
            <TextInput onChangeText={value => setEmail(value)} value={email} />
          </HStack>

          <HStack>
            <VStack>
              <HStack>
                <Text style={{ width: 110 }}>정기결제 만료일</Text>
                <TextInput
                  onChangeText={value => setRebillExpire(value)}
                  value={rebillExpire}
                  keyboardType="numeric"
                />
              </HStack>

              <HStack>
                <Text style={{ width: 110 }}></Text>
                <RedText>* 오늘 이후 날짜</RedText>
              </HStack>
            </VStack>
          </HStack>
        </VContainer>

        <ScrollView>
          <VContainer>
            <VStack>
              <Text>* 결제</Text>

              <HStack>
                <Button
                  onPress={() => {
                    payReqeust();
                  }}>
                  <ButtonTitle>결제 요청(SMS, WEB URL)</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    payCancel();
                  }}>
                  <ButtonTitle>결제(요청, 승인) 취소</ButtonTitle>
                </Button>
              </HStack>

              <HStack>
                <Button
                  onPress={() => {
                    payCancelReq();
                  }}>
                  <ButtonTitle>
                    결제 취소 요청(결제승인 후 D+ 5일이 경고 및 정산)
                  </ButtonTitle>
                </Button>
              </HStack>
            </VStack>
          </VContainer>

          <VContainer>
            <VStack>
              <Text>* 정기 결제</Text>

              <HStack>
                <Button
                  onPress={() => {
                    rebillRegist();
                  }}>
                  <ButtonTitle>정기 결제 요청</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    rebillCancel();
                  }}>
                  <ButtonTitle>정기 결제 해지</ButtonTitle>
                </Button>
              </HStack>

              <HStack>
                <Button
                  onPress={() => {
                    rebillStop();
                  }}>
                  <ButtonTitle>정기 결제 일시 정지</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    rebillStart();
                  }}>
                  <ButtonTitle>정기 결제 승인</ButtonTitle>
                </Button>
              </HStack>
            </VStack>
          </VContainer>

          <VContainer>
            <VStack>
              <Text>* 회원 가입</Text>

              <HStack>
                <Button
                  onPress={() => {
                    sellerRegist();
                  }}>
                  <ButtonTitle>판매자 회원 가입</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    useridCheck();
                  }}>
                  <ButtonTitle>판매자 아이디 중복 체크</ButtonTitle>
                </Button>
              </HStack>

              <HStack>
                <Button
                  onPress={() => {
                    subidRegist();
                  }}>
                  <ButtonTitle>부계정 등록</ButtonTitle>
                </Button>
              </HStack>
            </VStack>
          </VContainer>

          <VContainer>
            <VStack>
              <Text>* 현금영수증</Text>

              <HStack>
                <Button
                  onPress={() => {
                    cashStRegist();
                  }}>
                  <ButtonTitle>현금영수증 발행</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    cashStCancel();
                  }}>
                  <ButtonTitle>현금영수증 발행 취소</ButtonTitle>
                </Button>
              </HStack>

              <HStack>
                <Button
                  onPress={() => {
                    checkNpayCashReceiptReq();
                  }}>
                  <ButtonTitle>
                    네이버페이 현금영수증 발행 대상 금액 조회
                  </ButtonTitle>
                </Button>
              </HStack>
            </VStack>
          </VContainer>

          <VContainer>
            <VStack>
              <Text>* 결제회원(BILL)</Text>
              <HStack>
                <Button
                  onPress={() => {
                    setVisibleRegisterModal(true)
                  }}>
                  <ButtonTitle>결제회원(BILL) 등록</ButtonTitle>
                </Button>

                <Button
                  onPress={() => {
                    setVisibleListModal(true)
                  }}>
                  <ButtonTitle>결제회원(BILL) 리스트</ButtonTitle>
                </Button>
              </HStack>
            </VStack>
          </VContainer>
        </ScrollView>
      </Container>
    </TouchableWithoutFeedback >
  );
};

export default OApiScreen;
