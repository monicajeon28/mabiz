import Styled from 'styled-components/native'; 

export const SafeAreaContainer = Styled.View`
  flex:1;    
`;

export const Container = Styled.View`
    flex:1;    
    width: 100%;  
    background-color: #ffffff;
    align-items: center;
    padding: 10px;  
`;

export const ModalContainer = Styled.View`         
    width: 100%;
    height: 100%;
    padding-left: 20px;
    padding-right: 20px;
    background-color: #ffffff;
    align-items: center;
    justify-content: space-between;    
`;

export const VContainer = Styled.View`  
  width: 100%;        
  margin-vertical: 3px;
  border-radius: 1px;  
  border-color:#aaaaaa;
  border-width: 1px;
  padding: 5px;  
`;

export const HContainer = Styled.View`
  flex-direction: row;
  width: 100%;
  margin-vertical: 3px;
  border-radius: 1px;
  border-color:#aaaaaa;
  border-width: 1px;
  padding: 5px;  
`;

export const VStack = Styled.View`  
  width: 100%;      
`;

export const HStack = Styled.View`
  flex-direction: row;
  width: 100%;          
  align-items: center;
`;

export const Button = Styled.TouchableOpacity`
  flex: 1;   
  height: 60px;    
  margin: 3px;
  align-items: center;
  justify-content: center;
  border-radius: 1px;
  border-color:#aaaaaa;
  border-width: 1px;
`;

export const SmallButton = Styled.TouchableOpacity`
  flex: 1;   
  height: 40px;    
  margin: 3px;
  align-items: center;
  justify-content: center;
  border-radius: 1px;
  border-color:#aaaaaa;
  border-width: 1px;
`;

export const ButtonTitle = Styled.Text`       
  font-size: 13px; 
`;
 
export const TitleText = Styled.Text`  
  padding-top: 10px;
  font-size: 20px;
  color: #000000;
`;

export const Text = Styled.Text`
  font-size: 14px;   
  margin: 1px;  
`;
 
export const RedText = Styled.Text`  
  font-size: 11px;
  color: red;
  margin: 1px;
`;

export const TextInput = Styled.TextInput`     
  flex: 1;
  height: 35px; 
  margin: 3px;
  padding: 10px;
  font-size: 15px;
  border-radius: 1px;  
  border-color:#666666;
  border-width: 1px;
  background: #ffffff;  
`; 