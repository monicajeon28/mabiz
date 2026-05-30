import React from 'react';
import {
  Container,
  VStack,
  HStack,
  Button,
  ButtonTitle,
} from '~/Components/PAStyle';
import Styled from 'styled-components/native';

const LogoImage = Styled.Image` 
  width: 150px;
  height: 150px; 
  resizeMode: contain;  
  marginTop: 45%;  
  marginBottom: 45%;
`;

const MainScreen = ({ navigation }) => {
  return (
    <Container>
      <LogoImage source={require('~/Assets/Image/intro_logo.png')} />

      <HStack>
        <Button
          onPress={() => {
            navigation.navigate('AppToAppPayScreen');
          }}>
          <ButtonTitle> AppToApp 결제 연동 </ButtonTitle>
        </Button>

        <Button
          onPress={() => {
            navigation.navigate('AppToAppCashScreen');
          }}>
          <ButtonTitle> AppToApp 현금영수증 연동 </ButtonTitle>
        </Button>
      </HStack>

      <HStack>
        <Button
          title="OApi Api 연동"
          onPress={() => {
            navigation.navigate('OApiScreen');
          }}>
          <ButtonTitle> OApi Api 연동 </ButtonTitle>
        </Button>

        <Button
          onPress={() => {
            navigation.navigate('WebToAppScreen');
          }}>
          <ButtonTitle> WebToApp 연동 </ButtonTitle>
        </Button>
      </HStack>

    </Container>
  );
};

export default MainScreen;
