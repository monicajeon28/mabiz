import React, { useContext, useState, useEffect } from 'react';
import {
    ModalContainer,
    HStack,
    TextInput,
    TitleText,
    Text,
    Button,
    ButtonTitle,
    SafeAreaContainer
} from '~/Components/PAStyle';
import Styled from 'styled-components/native';
import { AppToAppCashContext } from '~/Screen/AppToApp/AppToAppCash/AppToAppCashContextProvider';
import { TouchableWithoutFeedback, Keyboard, SafeAreaView } from 'react-native';

export const CenterHStack = Styled.View`
  flex-direction: row;
  width: 100%;          
  justify-content: center;
`;

const CashReceiptCancelModal = () => {

    const {
        cashstno,
        setCashstno,
        cashReceiptCancel,
        setVisibleCashReceiptCancelModal,
    } = useContext(AppToAppCashContext);

    useEffect(() => {
    }, []);

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={SafeAreaContainer}>
                <ModalContainer>
                    <CenterHStack>
                        <TitleText>영수증 취소</TitleText>
                    </CenterHStack>

                    <HStack>
                        <Text style={{ width: 100 }}>cashstno (필수)</Text>
                        <TextInput onChangeText={value => setCashstno(value)} value={cashstno} keyboardType="numeric" />
                    </HStack>

                    <HStack>
                        <Button
                            onPress={() => {
                                setVisibleCashReceiptCancelModal(false);
                            }}>
                            <ButtonTitle>닫기</ButtonTitle>
                        </Button>

                        <Button
                            onPress={() => {
                                cashReceiptCancel();
                            }}>
                            <ButtonTitle>취소 요청</ButtonTitle>
                        </Button>
                    </HStack>
                </ModalContainer>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

export default CashReceiptCancelModal;
