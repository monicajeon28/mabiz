import React, { useContext, useEffect } from 'react';
import {
  ModalContainer,
  TitleText,
  VContainer,
  VStack,
  HStack,
  Text,
  Button,
  ButtonTitle,
  SafeAreaContainer,
} from '~/Components/PAStyle';
import Styled from 'styled-components/native';
import { OApiContext } from '~/Screen/OApi/OApiContextProvider';
import { TouchableWithoutFeedback, Keyboard, SafeAreaView } from 'react-native';

const MyList = Styled.FlatList`
  height: 400px;
  width: 100%;  
`;

const BillListModal = () => {

  const {
    billDataArray,
    billDelete,
    billPayment,
    setVisibleListModal,
  } = useContext(OApiContext);

  useEffect(() => {
    return () => {
      //   reset()
    };
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={SafeAreaContainer}>
        <ModalContainer>
          <TitleText>결제회원(BILL) 리스트</TitleText>

          <VContainer>
            <HStack>
              <MyList
                data={billDataArray}
                renderItem={({ item, index }) =>
                  <VContainer>
                    <VStack>
                      <HStack>
                        <Text style={{ width: 110 }}>구매자</Text>
                        <Text>{item.buyerName}</Text>
                      </HStack>

                      <HStack>
                        <Text style={{ width: 110 }}>카드번호</Text>
                        <Text>{item.cardNo}</Text>
                      </HStack>

                      <HStack>
                        <Button
                          onPress={() => {
                            billDelete(item)
                          }}>
                          <ButtonTitle>삭제</ButtonTitle>
                        </Button>

                        <Button
                          onPress={() => {
                            billPayment(item)
                          }}>
                          <ButtonTitle>결제</ButtonTitle>
                        </Button>

                      </HStack>
                    </VStack>
                  </VContainer>
                } />
            </HStack>
          </VContainer>

          <HStack>
            <Button
              onPress={() => {
                setVisibleListModal(false);
              }}>
              <ButtonTitle>닫기</ButtonTitle>
            </Button>
          </HStack>
        </ModalContainer>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

export default BillListModal;
