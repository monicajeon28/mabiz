# AOS_Payapp_Sample

#### 자세한 내용은 "Payapp 개발자 센터 (https://payapp.kr/dev_center/dev_center01.html)" 를 참고하세요.


기능 | 설명
---|---
AppLink|AppLink 관련 로직
OApi|Rest Api 관련 로직
WebToApp|WebToApp 관련 로직


## 기술 스펙
- JAVA
- lombok

* * *
* * *
* * *

# App Link
* * *
## 기본 구성
### 1. 개발사 앱 manifests 구성
* 개발사앱의 manifests에 리턴 스키마 등록
```xml
<intent-filter>
    <data
        android:host="payment.result"
        android:scheme="payappsamplev3" />
</intent-filter>
```


### 2. 통신

* 호출 파라미터
```
https://payapp.kr/sdk-app?reqType=OCR&phoneNumber=&goodPrice=1000&cardinst=1&goodName=상품명&hasTax=1&isAllPayReqType=0&returnUri=payappsamplev3://payment.result&feedbackurl=https://my_return.kr&checkretry=y&var1=var1Test&var2=var2Test
```
* 응답 파라미터
```
key=value 쌍으로 리턴 됨.
```


# App Link 결제 요청
## 1. 원격결제
> 구매자에게 결제 링크를 문자로 전송하여 구매자 핸드폰에서 결제를 합니다.

### 1-1 원격결제 호출 파라미터
파라미터 | 필수 | 비고
---|---|---
호출 URI|1|https://payapp.kr/sdk-app
reqType|1|REMOTE
returnUri|1|리턴 받을 고객사 URI 
phoneNumber|1|수신 전화번호
goodName|1|상품명
goodPrice|1|결제요청 금액 * 1,000원 이상부터 가능
hasTax|0|과세/면세 [과세:1, 면세:0] * 개인인 경우 면세
feedbackurl|0|결제완료 후 결과값을 리턴받을 고객사 URL
checkretry|0|feedbackurl 재시도 [y:재시도,n:재시도 안함]
var1|0|임의 사용 변수 1
var2|0|임의 사용 변수 2

### 1-2 원격결제 응답 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>값</th> 
    <th>비고</th>
  </tr>
  <tr>
    <td rowspan="2">state</td>
    <td>1</td>
    <td>성공</td> 
  </tr>
  <tr> 
    <td>0</td>
    <td>실패</td> 
  </tr>
  <tr> 
    <td>mul_no</td>
    <td></td>
    <td>결제 요청 번호</td> 
  </tr>
  <tr> 
    <td>payurl</td>
    <td></td>
    <td>결제창 URL</td> 
  </tr>
    <tr> 
    <td>errorMessage</td>
    <td></td>
    <td>에러 메시지</td> 
  </tr>  
  <tr> 
    <td>errorCode</td>
    <td></td>
    <td>에러 코드
    <br>9000: 로그인 오류
    <br>9010: 필수 파라미터 누락
    <br>9050: 원격결제 오류 
    </td> 
  </tr> 
  <tr> 
    <td>var1</td>
    <td></td> 
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td></td> 
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



## 2. 대면결제 (카메라, 수기, 네이버페이, 카카오페이, 스마일페이, 애플페이, 페이코, 위챗페이, 내통장결제, 토스페이, QR, NFC, 삼성페이)
> * 카메라 : 카메라로 카드번호를 추출하여 결제합니다.
> * 수기 : 수기로 카드번호, 유효기간, 비밀번호, 본인확인을 입력하여 결제합니다.
> * 네이버페이, 카카오페이, 스마일페이, 애플페이, 페이코, 위챗페이, 내통장결제, 토스페이, QR : QR을 구매자 디바이스 카메라로 열어 결제합니다. (페이앱에서 결제 완료 후 자동 리턴되지 않을 시 “결제확인” 버튼을 눌러주세요.)
> * NFC, 삼성페이 : AOS만 지원, NFC를 이용하여 IC카드, 삼성페이를 결제합니다. 단말기의 NFC모드는 “기본 모드”여야 합니다. 카드사에 따라 삼성페이 지원이 안 될수도 있습니다.

### 2-1 대면결제 호출 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>필수</th> 
    <th>비고</th>
  </tr>
  <tr>
    <td>호출 URI</td>
    <td>1</td> 
    <td>https://payapp.kr/sdk-app</td>
  </tr>
  <tr>
    <td rowspan="13">reqType</td>
    <td rowspan="13">1</td>
    <td>카메라결제: OCR</td> 
  </tr>
  <tr> 
    <td>수기결제: MANUAL</td> 
  </tr>
  <tr> 
    <td>네이버페이: NAVER_PAY</td> 
  </tr>
  <tr> 
    <td>카카오페이: KAKAO_PAY</td>
  </tr>
  <tr> 
    <td>스마일페이: SMILE_PAY</td> 
  </tr>
  <tr> 
    <td>애플페이: APPLE_PAY</td> 
  </tr>
  <tr> 
    <td>페이코: PAYCO</td> 
  </tr>
  <tr> 
    <td>위챗페이: WECHAT_PAY</td> 
  </tr>
  <tr> 
    <td>내통장결제: MY_ACCOUNT</td> 
  </tr>
  <tr> 
    <td>토스페이: TOSS_PAY</td> 
  </tr>
  <tr> 
    <td>QR: QR</td> 
  </tr>
  <tr> 
    <td>NFC: NFC</td> 
  </tr>
  <tr> 
    <td>삼성페이: SAMSUNG</td> 
  </tr>



  <tr> 
    <td>returnUri</td>
    <td>1</td> 
    <td>리턴 받을 고객사 URI </td>
  </tr> 
  <tr> 
    <td>phoneNumber</td>
    <td>0</td> 
    <td>수신 전화번호 * 10만원 이상 시 필수</td>
  </tr>
  <tr> 
    <td>goodName</td>
    <td>1</td> 
    <td>상품명</td>
  </tr>
  <tr> 
    <td>goodPrice</td>
    <td>1</td> 
    <td>결제요청 금액 * 1,000원 이상부터 가능 * 내통장결제(MY_ACCOUNT)는 10,000원이상 부터 가능</td>
  </tr>
  <tr> 
    <td>cardinst</td>
    <td>0</td> 
    <td>할부 [1~12] * 5만원 이상부터 가능 (카메라, 수기, NFC, 삼성페이) 미입력 시 일시불</td>
  </tr>
  <tr> 
    <td>hasTax</td>
    <td>0</td> 
    <td>과세/면세 [과세:1, 면세:0] * 개인인 경우 면세</td>
  </tr>
  <tr> 
    <td>isAllPayReqType</td>
    <td>0</td> 
    <td>모든 대면결제 타입 사용 [사용:1, 미사용:0]</td>
  </tr>
  <tr> 
    <td>feedbackurl</td>
    <td>0</td> 
    <td>결제완료 후 결과값을 리턴받을 고객사 URL</td> 
  </tr>
  <tr> 
    <td>checkretry</td>
    <td>0</td> 
    <td>feedbackurl 재시도 [y:재시도,n:재시도 안함]</td> 
  </tr>
  <tr> 
    <td>var1</td>
    <td>0</td> 
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td>0</td> 
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



### 2-2 대면결제 응답 파라미터
> * 해당 데이터는 DB 저장용으로 부적합 합니다.
<table>
  <tr>
    <th>파라미터</th>
    <th>값</th> 
    <th>비고</th>
  </tr>
  <tr>
    <td rowspan="2">state</td>
    <td>1</td>
    <td>성공</td> 
  </tr>
  <tr> 
    <td>0</td>
    <td>실패</td> 
  </tr>
  <tr> 
    <td>mul_no</td>
    <td></td>
    <td>결제 요청 번호</td> 
  </tr>
  <tr> 
    <td>csturl</td>
    <td></td>
    <td>페이앱 영수증 URL</td> 
  </tr>
  <tr> 
    <td>errorMessage</td>
    <td></td>
    <td>에러 메시지</td> 
  </tr>  
  <tr> 
    <td>errorCode</td>
    <td></td>
    <td>에러 코드
    <br>9000: 로그인 오류
    <br>9010: 필수 파라미터 누락
    <br>9020: 결제타입 오류
    <br>9040: 시간초과</td> 
  </tr>  
  <tr> 
    <td>cardName</td>
    <td></td>
    <td>카드사 이름</td> 
  </tr>  
  <tr> 
    <td>cardNum</td>
    <td></td>
    <td>카드번호</td> 
  </tr>  
  <tr>
    <td>cardAuthNumber</td>
    <td></td>
    <td>카드승인번호</td> 
  </tr>
  <tr> 
    <td>date</td>
    <td></td>
    <td>결제일</td> 
  </tr>
  <tr> 
    <td>installment</td>
    <td></td>
    <td>할부 개월</td> 
  </tr> 
  <tr> 
    <td>goodName</td>
    <td></td>
    <td>상품명</td> 
  </tr>  
  <tr> 
    <td>var1</td>
    <td></td> 
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td></td> 
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



## 3. 현금영수증 (발행, 취소)
> * 사업자만 현금영수증 발행이 가능하며, 개인은 불가능합니다.
>
### 3-1-1 현금영수증 발행 호출 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>필수</th>
    <th>비고</th>
  </tr>
  <tr> 
    <td>호출 URI</td>
    <td>1</td>
    <td>https://payapp.kr/sdk-app</td>
  </tr>
  <tr> 
    <td>reqType</td>
    <td>1</td>
    <td>CASH_RECEIPT</td>
  </tr>
  <tr> 
    <td>returnUri</td>
    <td>1</td>
    <td>리턴 받을 고객사 URI </td>
  </tr> 
  <tr> 
    <td>trCode</td>
    <td>1</td>
    <td>소득공제용: 0, 지출증빙용: 1</td>
  </tr>
  <tr> 
    <td>tradeTime</td>
    <td>1</td>
    <td>원거래시각 [YYYYMMDDHHMMSS]</td>
  </tr>
  <tr> 
    <td>idInfo</td>
    <td>1</td>
    <td>소득공제용 발행 시: 휴대폰번호<br/>지출증빙용 발행 시: 사업자번호</td>
  </tr> 
  <tr> 
    <td>name</td>
    <td>1</td>
    <td>구매자 또는 사업자 명</td>
  </tr> 
  <tr> 
    <td>goodName</td>
    <td>1</td>
    <td>상품명</td>
  </tr>
  <tr> 
    <td>goodPrice</td>
    <td>1</td>
    <td>발행 요청 금액</td>
  </tr>
  <tr> 
    <td>svc</td>
    <td>0</td>
    <td>봉사료</td> 
  </tr> 
  <tr> 
    <td>email</td>
    <td>0</td>
    <td>이메일</td> 
  </tr>
  <tr> 
    <td>hasTax</td>
    <td>0</td>
    <td>과세/면세 [과세:1, 면세:0]</td> 
  </tr> 
  <tr> 
    <td>var1</td>
    <td>0</td>
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td>0</td>
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



### 3-1-2 현금영수증 발행 응답 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>값</th> 
    <th>비고</th>
  </tr>
  <tr>
    <td rowspan="2">state</td>
    <td>1</td>
    <td>성공</td> 
  </tr>
  <tr> 
    <td>0</td>
    <td>실패</td> 
  </tr>
  <tr> 
    <td>cashstno</td>
    <td></td>
    <td>현금영수증 발행 번호</td> 
  </tr>
  <tr> 
    <td>cashsturl</td>
    <td></td>
    <td>현금영수증 URL</td> 
  </tr>
  <tr> 
    <td>receiptno</td>
    <td></td>
    <td>승인 번호</td> 
  </tr>  
  <tr> 
    <td>price</td>
    <td></td>
    <td>현금영수증 발행 총 금액</td> 
  </tr>  
  <tr> 
    <td>errorMessage</td>
    <td></td>
    <td>에러메세지</td> 
  </tr>  
  <tr> 
    <td>errorCode</td>
    <td></td>
    <td>에러 코드
    <br>9000: 로그인 오류
    <br>9010: 필수 파라미터 누락</td> 
  </tr>
  <tr> 
    <td>var1</td>
    <td></td> 
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td></td> 
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



### 3-2-1 현금영수증 취소 호출 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>필수</th>
    <th>비고</th>
  </tr>
  <tr> 
    <td>호출 URI</td>
    <td>1</td>
    <td>https://payapp.kr/sdk-app</td>
  </tr>
  <tr> 
    <td>reqType</td>
    <td>1</td>
    <td>CASH_RECEIPT_CANCEL</td>
  </tr>
  <tr> 
    <td>returnUri</td>
    <td>1</td>
    <td>리턴 받을 고객사 URI </td>
  </tr>
  <tr> 
    <td>cashstno</td>
    <td>1</td>
    <td>현금영수증 발행 번호</td> 
  </tr>
  <tr> 
    <td>var1</td>
    <td>0</td>
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td>0</td>
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



### 3-2-2 현금영수증 취소 응답 파라미터
<table>
  <tr>
    <th>파라미터</th>
    <th>값</th> 
    <th>비고</th>
  </tr>
  <tr>
    <td rowspan="2">state</td>
    <td>1</td>
    <td>성공</td> 
  </tr>
  <tr> 
    <td>0</td>
    <td>실패</td> 
  </tr>
  <tr> 
    <td>receiptno</td>
    <td></td>
    <td>승인 번호</td> 
  </tr> 
  <tr> 
    <td>errorMessage</td>
    <td></td>
    <td>에러메세지</td> 
  </tr>  
  <tr> 
    <td>errorCode</td>
    <td></td>
    <td>에러 코드
    <br>9000: 로그인 오류
    <br>9010: 필수 파라미터 누락</td> 
  </tr>
  <tr> 
    <td>var1</td>
    <td></td> 
    <td>임의 사용 변수 1</td> 
  </tr>
  <tr> 
    <td>var2</td>
    <td></td> 
    <td>임의 사용 변수 2</td> 
  </tr>
</table>



* * *
* * *
* * *

# OAPI
1. Payapp Developers(https://api.payapp.kr/dev_center/dev_center01.html) 의 REST API 내용입니다.
2. 페이북/ISP 등의 앱카드는 USB를 제거 후 테스트 하세요.
3. 앱 내 WebView를 통한 결제는 몇 가지 설정이 필요합니다. "PAWebView" 내용을 확인해 주세요.
* * *
## 1. 기본 구성
### 1-1. LINK_KEY 설정합니다.
> (https://seller.payapp.kr/c/apiconnect_info) 에서 LINK_KEY 등록

### 1-2. network_security_config.xml 추가
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>

    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">mobile.vpay.co.kr</domain>
    </domain-config>

</network-security-config>
```
### 1-2. manifests 앱카드 등록
```xml
<queries>

    <package android:name="com.udid.payapp" />

    <!-- Payapp OAPI 사용시 추가 -->
    <!-- 신용카드 -->
    <package android:name="kvp.jjy.MispAndroid320" /> <!-- 페이북/ISP -->
    <package android:name="com.kbcard.cxh.appcard" /> <!-- KBPay -->
    <package android:name="com.lotte.lottesmartpay" /> <!-- 롯데 모바일 결제-->
    <package android:name="com.lcacApp" /> <!-- 롯데 앱카드 -->
    <package android:name="com.hyundaicard.appcard" /> <!-- 현대 앱카드 -->
    <package android:name="kr.co.samsungcard.mpocket" /> <!-- 삼성 앱카드, 삼성 앱카드 공동인증서 -->
    <package android:name="com.shcard.smartpay" /> <!-- 신한 페이판 -->
    <package android:name="nh.smart.mobilecard" /> <!-- NH 앱카드 -->
    <package android:name="nh.smart.nhallonepay" /> <!-- NH 올원페이, NH 올원페이 공동인증서 -->
    <package android:name="com.samsung.android.spay" /> <!-- 삼성페이 -->
    <package android:name="com.nhnent.payapp" /> <!-- payco -->
    <package android:name="kr.co.citibank.citimobile" /> <!-- 씨티카드 -->
    <package android:name="kr.co.citibank.cardapp" /> <!-- 씨티뱅크 카드앱 -->
    <package android:name="com.skp.android.paypin" /> <!-- 페이핀 -->
    <package android:name="com.lge.lgpay" /> <!-- 엘지페이(삼성, KB) -->
    <package android:name="com.lotte.lpay" /> <!-- L.pay -->
    <package android:name="com.wooricard.wpay" /> <!-- 우리 app 카드 -->
    <package android:name="com.hanaskcard.paycla" /> <!-- 하나카드 원큐페이 -->
    <package android:name="com.wooricard.smartapp" /> <!-- 우리 WON 뱅크 -->
    <package android:name="com.tmoney.nfc_app" /> <!-- 티머니 댐댐 -->
    <package android:name="com.tmoney.inapp" /> <!-- 티머니 인앱 -->
    <package android:name="viva.republica.toss" /> <!-- 토스 -->
    <package android:name="com.shinhan.smartcaremgr" /> <!-- 신한 슈퍼SOL -->
    <package android:name="com.kakaobank.channel" /> <!-- 카카오뱅크 -->

    <!-- 백신 -->
    <package android:name="com.ahnlab.v3mobileplus" /> <!-- V3 -->
    <package android:name="com.TouchEn.mVaccine.webs" /> <!-- TouchEn mVaccine(신한) -->
    <package android:name="kr.co.shiftworks.vguardweb" />


    <package android:name="com.shinhancard.smartshinhan" /> <!-- 신한(ARS/일반결제/Smart결제), 신한 공동인증서 -->
    <package android:name="com.kbstar.liivbank" /> <!-- LiiV(국민은행) -->
    <package android:name="com.kbstar.reboot" /> <!-- new liiv -->
    <package android:name="ispmobile" /> <!-- 페이북/ISP -->
    <package android:name="kr.co.hanamembers.hmscustomer" /> <!-- 하나멤버스 -->


    <!-- 공인인증 -->
    <package android:name="com.hanaskcard.rocomo.potal" /> <!-- 하나카드 -->
    <package android:name="com.lumensoft.touchenappfree" /> <!-- 공동인증서 -->


    <!-- 간편결제 -->
    <package android:name="com.samsung.android.spaylite" /> <!-- 삼성페이 미니(삼성, KB) -->
    <package android:name="com.kakao.talk" /> <!-- 카카오페이 -->
    <package android:name="com.nhn.android.search" /> <!-- 네이버페이 -->
    <package android:name="com.ssg.serviceapp.android.egiftcertificate" /> <!-- SSGPay(현대) -->
    <package android:name="com.nhnent.payapp" /> <!-- 페이코(삼성, 농협, KB) -->
    <package android:name="com.lottemembers.android" /> <!-- LPay -->
    <package android:name="com.coocon.zeropayHub" /> <!-- 제로페이 -->
    <package android:name="com.mysmilepay.app" /> <!-- 스마일페이 -->

    <!-- 계좌이체 -->
    <package android:name="com.kftc.bankpay.android" /> <!-- 금융결제원 -->


    <!-- 본인인증 -->
    <package android:name="com.sktelecom.tauth" /> <!-- SKT -->
    <package android:name="com.kt.ktauth" /> <!-- KT -->
    <package android:name="com.lguplus.smartotp" /> <!-- LGT -->

</queries>
```

* * *
* * *
* * *

# WebToApp
1. 앱 내 웹뷰를 이용한 Payapp 호출입니다.
2. 작동 방식은 App Link와 동일합니다.
3. PAWebView.java의 "setPAWebViewClient()"함수를 확인하세요.
 
