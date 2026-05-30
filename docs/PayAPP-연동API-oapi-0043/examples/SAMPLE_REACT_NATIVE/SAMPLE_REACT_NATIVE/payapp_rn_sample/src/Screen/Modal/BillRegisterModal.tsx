import React, { useContext, useState, useEffect } from 'react';
import {
    ModalContainer,
    TitleText,
    VContainer,
    HStack,
    Text,
    TextInput,
    RedText,
    Button,
    ButtonTitle,
    SafeAreaContainer
} from '~/Components/PAStyle';
import { OApiContext } from '~/Screen/OApi/OApiContextProvider';
import { TouchableWithoutFeedback, Keyboard, SafeAreaView } from 'react-native';

const BillRegisterModal = () => {

    const {
        resetModal,
        userId,
        setUserID,
        cardNo,
        setCardNo,
        cardPw,
        setCardPw,
        expMonth,
        setExpMonth,
        expYear,
        setExpYear,
        buyerAuthNo,
        setBuyerAuthNo,
        buyerPhone,
        setBuyerPhone,
        buyerName,
        setBuyerName,
        billRegister,
        setVisibleRegisterModal,
    } = useContext(OApiContext);

    useEffect(() => {
        return () => {
            resetModal()
        };
    }, []);

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={SafeAreaContainer}>
                <ModalContainer>
                    <TitleText>결제회원(BILL 등록)</TitleText>
                    <VContainer>
                        <HStack>
                            <Text style={{ width: 110 }}>유저 아이디</Text>
                            <TextInput onChangeText={value => setUserID(value)} value={userId} />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>카드번호</Text>
                            <TextInput onChangeText={value => setCardNo(value)} value={cardNo} keyboardType="numeric" />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>유효기간(월)</Text>
                            <TextInput onChangeText={value => setExpMonth(value)} value={expMonth} keyboardType="numeric" />

                            <Text>유효기간(년)</Text>
                            <TextInput onChangeText={value => setExpYear(value)} value={expYear} keyboardType="numeric" />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>인증번호</Text>
                            <TextInput onChangeText={value => setBuyerAuthNo(value)} value={buyerAuthNo} keyboardType="numeric" />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}></Text>
                            <RedText>* 개인: 생년월일(YYMMDD)  법인: 사업자번호</RedText>
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>카드 비밀번호</Text>
                            <TextInput onChangeText={value => setCardPw(value)} value={cardPw} keyboardType="numeric" secureTextEntry={true} />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}></Text>
                            <RedText>* 앞 두자리 (**)</RedText>
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>구매자 전화번호</Text>
                            <TextInput onChangeText={value => setBuyerPhone(value)} value={buyerPhone} keyboardType="numeric" />
                        </HStack>

                        <HStack>
                            <Text style={{ width: 110 }}>구매자 성함</Text>
                            <TextInput onChangeText={value => setBuyerName(value)} value={buyerName} />
                        </HStack>
                    </VContainer>

                    <HStack>
                        <Button
                            onPress={() => {
                                setVisibleRegisterModal(false);
                            }}>
                            <ButtonTitle>닫기</ButtonTitle>
                        </Button>
                        <Button
                            onPress={() => {
                                billRegister()
                            }}>
                            <ButtonTitle>등록</ButtonTitle>
                        </Button>
                    </HStack>
                </ModalContainer>
            </SafeAreaView>
        </TouchableWithoutFeedback >
    );
}

export default BillRegisterModal;
