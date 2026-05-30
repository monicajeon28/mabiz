import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppToAppPayContextProvider } from '~/Screen/AppToApp/AppToAppPayment/AppToAppPayContextProvider';
import { AppToAppCashContextProvider } from '~/Screen/AppToApp/AppToAppCash/AppToAppCashContextProvider';
import { OApiContextProvider } from '~/Screen/OApi/OApiContextProvider';
const Stack = createStackNavigator();

import MainScreen from './Main/MainScreen';
import AppToAppPayScreen from './AppToApp/AppToAppPayment/AppToAppPayScreen';
import AppToAppCashScreen from './AppToApp/AppToAppCash/AppToAppCashScreen';
import OApiScreen from './OApi/OApiScreen';
import WebViewScreen from './OApi/WebViewScreen';
import WebToAppScreen from './WebToApp/WebToAppScreen';
 
const MainNavigator = () => {
  return (
    <NavigationContainer>
      <AppToAppPayContextProvider>
        <AppToAppCashContextProvider>
          <OApiContextProvider>            
              <Stack.Navigator>
                <Stack.Screen name="Main" options={{ headerShown: false }} component={MainScreen} />
                {/* 페이앱을 연동한 AppToApp 결제 */}
                <Stack.Screen name="AppToAppPayScreen" component={AppToAppPayScreen} />
                {/* 페이앱을 연동한 AppToApp 현금영수증 */}
                <Stack.Screen name="AppToAppCashScreen" component={AppToAppCashScreen} />
                {/* Open Api 연동 */}
                <Stack.Screen name="OApiScreen" component={OApiScreen} />
                {/* 페이앱을 연동한 WebToApp 결제 */}
                <Stack.Screen name="WebToAppScreen" component={WebToAppScreen} />
                <Stack.Screen name="WebViewScreen" component={WebViewScreen} />
              </Stack.Navigator>
          </OApiContextProvider>
        </AppToAppCashContextProvider>
      </AppToAppPayContextProvider>
    </NavigationContainer>
  );
};

export default MainNavigator;
