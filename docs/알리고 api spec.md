#### API SPEC 및 연동예제 안내

알림톡 보내기 및 관련 API 사용시 아래내용을 반드시 참고하여 주시기 바랍니다.  
현재 제공되는 문자연동 API는 다음과 같습니다.

- 카카오채널 관리 - 인증요청
- 카카오채널 관리 - 카테고리 조회
- 카카오채널 관리 - 친구등록 심사 요청
- 카카오채널 관리 - 등록된 카카오채널 리스트
- 템플릿 관리 - 신규 템플릿 생성
- 템플릿 관리 - 템플릿 수정
- 템플릿 관리 - 템플릿 삭제 요청
- 템플릿 관리 - 템플릿 검수 요청
- 알림톡 전송
- 브랜드메시지 템플릿 생성 - TEXT 타입
- 브랜드메시지 템플릿 생성 - IMAGE, WIDE 타입
- 브랜드메시지 템플릿 생성 - WIDE_ITEM_LIST 타입
- 브랜드메시지 템플릿 생성 - CAROUSEL_FEED 타입
- 브랜드메시지 템플릿 생성 - PREMIUM_VIDEO 타입
- 브랜드메시지 템플릿 생성 - COMMERCE 타입
- 브랜드메시지 템플릿 생성 - CAROUSEL_COMMERCE 타입
- 브랜드 메시지 템플릿 조회
- 브랜드메시지 전송
- 전송내역조회
- 전송결과조회(상세)
- 발송가능건수
- 예약문자 취소

 

##### 카카오채널 관리 - 인증요청

알림톡 및 브랜드메시지을 전송하기 위해서는 반드시 카카오채널을 인증한 후 진행해야 합니다. 보유한 카카오채널 계정이 없을경우 ( [https://center-pf.kakao.com](https://center-pf.kakao.com/) ) 에서 등록하신 후 진행 가능합니다.

[ Request ]

            `POST /akv10/profile/auth/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다. 카카오톡을 통하여 인증메시지가 전송됩니다..

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|plusid|카카오채널 아이디(@포함)|O|String|
|phonenumber|카카오채널 알림받는 관리자 핸드폰 번호|O|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/profile/auth/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "plusid=@테스트" \                 --data-urlencode "phonenumber=01011111111"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|

인증요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 호출하였습니다."                 }`
            

인증요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 509                     "message": "요청한 번호가 카카오채널 관리자 알림 설정 되어있는지 확인해주세요."                 }`
            
            

 

##### 카카오채널 관리 - 카테고리 조회

알림톡 발신프로필 심사요청시 사용가능한 카테고리 정보 입니다. "thirdBusinessType" 의 code 를 기입하시면 됩니다.

[ Request ]

            `POST /akv10/category/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/category/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|조회된 카테고리 코드|String|

인증요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 호출하였습니다."                     "data": {                             firstBusinessType: [{"parentCode": "", "code":"001", "name":"건강"}...],                             secondBusinessType: [{"parentCode": "001", "code":"001001", "name":"병원"}...],                             thirdBusinessType: [{"parentCode": "0010001", "code":"00100010001", "name":"종합병원"}...]                     }                 }`
            

인증요청이 실패하였을 경우

            `HTTP/1.1 -99 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 509                     "message": "계정 아이디(=userid) 파라메더 정보가 전달되지 않았습니다."                 }`
            
            

 

##### 카카오채널 관리 - 친구등록 심사 요청

알림톡 및 브랜드메시지을 전송하기 위해서는 카카오채널을 심사요청 후 진행해야 하며 다음-카카오측의 심사요청 결과에 따라 거부되어 재심사 요청이 발생할 수 있습니다.

[ Request ]

            `POST /akv10/profile/add/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다. 카카오톡을 통하여 인증메시지가 전송됩니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|plusid|카카오채널 아이디(@포함)|O|String|
|authnum|발신프로필 인증번호  <br>("카카오채널 관리 - 인증요청 API" 로 생성)|O|String|
|phonenumber|카카오채널 알림받는 관리자 핸드폰 번호|O|String|
|categorycode|발신프로필의 카테고리 코드  <br>("카카오채널 관리 - 카테고리 조회" 로 확인)|O|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/profile/add/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "plusid=@테스트" \                 --data-urlencode "authnum=12345" \                 --data-urlencode "phonenumber=01000000000"                 --data-urlencode "categorycode=00000000000"`

                
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|생성된 발신 프로필 키|array|
|senderKey|발신프로필키|text|
|uuid|플러스친구|text|
|name|플러스친구 프로필명|text|
|status|상태(A:정상, S:차단, D:삭제)|text|
|profileStat|플러스친구 상태  <br>(A:activated, C:deactivated, B:block, E:deleting, D:deleted)|text|
|cdate|등록일|text|
|udate|최종수정일|text|
|catCode|카테고리 코드|text|
|alimUseYn|알림톡 사용 여부|boolean|

인증요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 호출하였습니다."                     "data": [{                         "senderKey": "XXXXXXXXXXXXXXXXXXXXXXXXXX",                         "uuid": "@xxxx",                         "name": "xxxx",                         "status": "A",                         "profileStat": "A",                         "cdate": "2026-06-20 13:34:17",                         "udate": "2026-06-20 13:34:17",                         "catCode": "00000000000",                         "alimUseYn": false                     }]                 }`
            

인증요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 509                     "message": "요청한 번호가 카카오채널 관리자 알림 설정 되어있는지 확인해주세요."                 }`
            
            

 

##### 카카오채널 관리 - 등록된 카카오채널 리스트

등록된 카카오채널 목록을 조회합니다.

[ Request ]

            `POST /akv10/profile/list/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|plusid|카카오채널 아이디(@포함)|X|String|
|senderkey|발신프로필 키|X|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/profile/list/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|list|등록된 발신프로필 목록|array|
|senderKey|발신프로필키|String|
|catCode|카테고리 코드|String|
|name|발신 프로필명|String|
|profileStat|카카오채널 상태  <br>(A:activated, C:deactivated, B:block, E:deleting, D:deleted)|String|
|status|상태(A:정상, S:차단, D:삭제)|String|
|cdate|등록일|Text|
|udate|최종 수정일|Text|

정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 호출하였습니다."                     "list": [{                         "senderKey": "000000000000000000000000000000000000",                         "license": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",                         "catCode": "00000000000",                         "alimUseYn": false,                         "cdate": "2026-06-20 13:34:17",                         "name": "테스트",                         "profileStat": "A",                         "licenseNum": "테스트",                         "udate": "2026-06-20 13:34:17",                         "uuid": "@test",                         "status": "A"                     }]                 }`
            

조회에 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "등록되지 않은 인증키 입니다."                 }`
            
            

 

##### 템플릿 관리 - 등록된 템플릿 리스트

등록된 템플릿 목록을 조회합니다. 템플릿 코드가 D 나 P 로 시작하는 경우 공유 템플릿이므로 삭제 불가능 합니다.

[ Request ]

            `POST /akv10/template/list/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|tpl_code|템플릿 코드|X|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/template/list/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxx"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|list|등록된 발신프로필 목록|array|
|senderKey|발신프로필키|String|
|templtCode|템플릿 코드|String|
|templtContent|등록된 템플릿 콘텐츠|String|
|templtName|템플릿 명|String|
|templateType|템플릿 메세지 유형  <br>BA: 기본형, EX: 부가 정보형, AD: 광고 추가형, MI: 복합형|String|
|templateEmType|템플릿 강조유형  <br>NONE: 선택안함, TEXT: 강조표기형, IMAGE: 이미지형|String|
|templtTitle|강조표기 핵심정보|String|
|templtSubtitle|강조표기 보조문구|String|
|templtImageName|템플릿 이미지 파일명|String|
|templtImageUrl|템플릿 이미지 링크|String|
|status|상태 (S: 중단, A: 정상, R: 대기)|String|
|inspStatus|승인상태 (REG: 등록, REQ: 심사요청, APR: 승인, REJ: 반려)|String|
|cdate|템플릿 생성일|String|
|comments|템플릿 코멘트|Text|
|buttons|템플릿에 사용된 버튼 정보|Array|
|ordering|버튼 순서 (1 ~ 5)|String|
|name|버튼명|String|
|linkType|버튼타입 (AC: 채널추가, DS: 배송조회, WL: 웹링크, AL: 앱링크, BK: 봇키워드, MD: 메시지전달)|String|
|linkTypeName|버튼타입명|String|
|linkMo|모바일 웹링크 (WL일때)|String|
|linkPc|PC 웹링크 (WL일때)|String|
|linkIos|IOS 앱링크 (AL일때)|String|
|linkAnd|안드로이드 앱링크 (AL일때)|String|

정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 호출하였습니다."                     "list": [{                         "templtContent": "#{고객명}님께서 주문하신 물품이\r\n배송완료 되었습니다.\r\n구매확정 부탁드립니다.",                         "templtName": "배송완료 안내",                         "status": "R",                         "inspStatus": "APR",                         "senderKey": "000000000000000000000000000000000000",                         "buttons": [                             {                                 "ordering": "1",                                 "name": "구매확정바로가기",                                 "linkType": "WL",                                 "linkTypeName": "웹링크",                                 "linkMo": "http://#{구매확정바로가기}",                                 "linkPc": "http://#{구매확정바로가기}",                                 "linkIos": "",                                 "linkAnd": ""                             }                         ],                         "cdate": "2018-12-28 17:21:40",                         "templtCode": "P000004",                         "comments": []                     }],                     "info": {                         "REG": 0,                         "REQ": 0,                         "APR": 1,                         "REJ": 0                     }                 }`
            

 

##### 템플릿 관리 - 신규 템플릿 생성

알림톡을 전송하기 위해서는 템플릿을 작성해야 하며, 작성된 템플릿은 다음-카카오측의 4-5일간의 검수후 결과에 따라 거부되어 재작성 요청이 발생할 수 있습니다.

[ Request ]

            `POST /akv10/template/add/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다. 등록한 템플릿에 대한 검수는 API로 요청을 하셔야 합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로파일 키|O|String|
|tpl_name|템플릿 이름|O|String|
|tpl_content|템플릿 내용|O|String|
|tpl_secure|보안 템플릿 여부|X|"Y" or "N"|
|tpl_type|템플릿 메세지 유형|X|BA: 기본형, EX: 부가 정보형, AD: 광고 추가형, MI: 복합형|
|tpl_emtype|템플릿 강조유형|X|NONE: 선택안함, TEXT: 강조표기형, IMAGE: 이미지형|
|tpl_advert|수신동의 문구 또는 간단광고 문구|X|광고 추가형(AD) 템플릿인 경우 필수 입력|
|tpl_extra|부가 정보|X|String|
|tpl_title|강조표기 핵심정보|X|String|
|tpl_stitle|강조표기 보조문구|X|String|
|image|템플릿 이미지|X|JPEG,PNG|
|tpl_name|템플릿 이름|O|String|

tpl_button 상세

|변수|설명|필수|타입|
|---|---|---|---|
|name|버튼명|O|String|
|linkType|버튼의 링크타입  <br>(AC: 채널추가, DS: 배송조회, WL: 웹링크, AL: 앱링크, BK: 봇키워드, MD: 메시지전달)|O|String|
|linkM|모바일 웹링크주소  <br>(http:// 또는 https:// 필수)|WL 일때 필수|String|
|linkP|PC 웹링크주소  <br>(http:// 또는 https:// 필수)|WL 일때 필수|String|
|linkI|IOS 앱링크주소|AL 일때 필수|String|
|linkA|Android 앱링크주소|AL 일때 필수|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/template/add/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "tpl_name=테스트이름" \                 --data-urlencode "tpl_content=테스트내용"                 --data-urlencode "tpl_button={"button":[{"name":"웹링크","linkType":"WL","linkM":"http:\/\/#{버튼변수}",                 "linkP":"http:\/\/#{버튼변수}"}]}"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|생성한 템플릿 정보|String|

템플릿생성 요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 템플릿을 생성하였습니다."                     "data": {                         "senderKey": "XXXXXXXXXXXXXX",                         "templtContent": "등록한 템플릿 컨텐츠",                         "templtName": "등록한 템플릿 명",                         "cdate": "2026-06-20 13:34:17",                         "comments": [],                         "buttons": [                             {                                 "ordering": "1",                                 "name": "웹링크",                                 "linkType": "WL",                                 "linkTypeName": "웹링크",                                 "linkMo": "http://#{버튼변수}",                                 "linkPc": "http://#{버튼변수}",                                 "linkIos": "",                                 "linkAnd": ""                             }                         ],                         "templtCode": XXXXXXXX                         "udate":                          "inspStatus": REG                         "status": R                     }                 }`
            

템플릿생성 요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "발신 프로파일 키(=senderkey)파라메더 정보가 전달되지 않았습니다."                 }`
            
            

 

##### 템플릿 관리 - 템플릿 수정

작성 또는 반려된 템플릿을 수정하는 기능이며, 템플릿상태가 대기(R)이고 템플릿 검수상태가 등록(REG) 또는 반려(REJ)인 경우에만  
수정 가능합니다.

[ Request ]

            `POST /akv10/template/modify/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다. 등록한 템플릿에 대한 검수는 API로 요청을 하셔야 합니다. .

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로파일 키|O|String|
|tpl_code|템플릿 코드|O|String|
|tpl_name|템플릿 이름|O|String|
|tpl_content|템플릿 내용|O|String|
|tpl_button|템플릿 버튼|X|JSON|
|tpl_secure|보안 템플릿 여부|X|"Y" or "N"|
|tpl_type|템플릿 메세지 유형|X|AC: 채널추가, BA: 기본형, EX: 부가 정보형, AD: 광고 추가형, MI: 복합형|
|tpl_emtype|템플릿 강조유형|X|NONE: 선택안함, TEXT: 강조표기형, IMAGE: 이미지형|
|tpl_extra|부가 정보|X|String|
|tpl_title|강조표기 핵심정보|X|String|
|tpl_stitle|강조표기 보조문구|X|String|
|image|템플릿 이미지|X|JPEG,PNG|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/template/modify/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "tpl_name=템플릿코드" \                 --data-urlencode "tpl_name=수정된템플릿명" \                 --data-urlencode "tpl_content=수정된템플릿내용"                 --data-urlencode "tpl_button={"button":[{"name":"웹링크","linkType":"WL","linkM":"http:\/\/#{버튼변수}",                 "linkP":"http:\/\/#{버튼변수}"}]}"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|생성한 템플릿 정보|String|

템플릿수정 요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 템플릿을 수정하였습니다."                     "data": {                         "senderKey": "XXXXXXXXXXXXXX",                         "templtContent": "수정한 템플릿 컨텐츠",                         "templtName": "수정한 템플릿 명",                         "cdate": "2026-06-20 13:34:17",                         "comments": [],                         "buttons": [                             {                                 "ordering": "1",                                 "name": "웹링크",                                 "linkType": "WL",                                 "linkTypeName": "웹링크",                                 "linkMo": "http://#{버튼변수}",                                 "linkPc": "http://#{버튼변수}",                                 "linkIos": "",                                 "linkAnd": ""                             }                         ],                         "templtCode": XXXXXXXX                         "udate":                          "inspStatus": REG                         "status": R                     }                 }`
            

템플릿수정 요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 509                     "message": "수정 가능 상태가 아닙니다."                 }`
            
            

 

##### 템플릿 관리 - 템플릿 삭제 요청

승인이 이루어지지 않은 템플릿에 대하여 삭제요청 합니다. 삭제는 즉시 이루어 지나 이미 승인이 완료된 템플릿은 삭제불가 합니다.

[ Request ]

            `POST /akv10/template/del/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로파일 키|O|String|
|tpl_code|템플릿 코드|O|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/template/del/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "tpl_code=TXXXXXXXX"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|

템플릿삭제 요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "정상적으로 템플릿을 삭제 하였습니다."                 }`
            

템플릿삭제 요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "발신 프로파일 키(=senderkey)파라메더 정보가 전달되지 않았습니다."                 }`
            
            

 

##### 템플릿 관리 - 템플릿 검수 요청

작성이 완료된 템플릿에 대하여 검수요청을 합니다. 검수 결과에 따라 재작성 요청이 발생 할 수 있습니다.

[ Request ]

            `POST /akv10/template/request/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다. 검수기간은 4-5일 정도가 소요되며 결과에 따라 재작성 요청이 발생 할 수있습니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로파일 키|O|String|
|tpl_code|템플릿 코드|O|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/template/request/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "tpl_code=TXXXXXXXX"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|

템플릿검수 요청이 정상적으로 성공했을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "검수요청을 하였습니다."                 }`
            

템플릿검수 요청이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "발신 프로파일 키(=senderkey)파라메더 정보가 전달되지 않았습니다."                 }`
            
            

 

##### 알림톡 전송

알림톡 전송을 요청합니다. 템플릿 서식과 일치하지 않을경우 전송되지 않습니다.

[ Request ]

            `POST /akv10/alimtalk/send/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로파일 키|O|String|
|tpl_code|템플릿 코드|O|String|
|sender|발신자 연락처|O|String|
|senddate|예약일|X|datetime|
|receiver_1 (1 ~ 500)|수신자 연락처|O|String|
|recvname_1 (1 ~ 500)|수신자 이름|X|String|
|subject_1 (1 ~ 500)|알림톡 제목|O|String|
|message_1 (1 ~ 500)|알림톡 내용|O|String|
|emtitle_1 (1 ~ 500)|강조표기형의 타이틀|X|String|
|button_1 (1 ~ 500)|버튼 정보|X|JSON|
|failover|실패시 대체문자 전송기능|X|Y or N|
|fsubject_1 (1 ~ 500)|실패시 대체문자 제목|X|String|
|fmessage_1 (1 ~ 500)|실패시 대체문자 내용|X|String|
|testMode|테스트 모드 적용여부 (Y or N)|X (기본 N)|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/akv10/alimtalk/send/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "tpl_code=TXXXXXXXX" \                 --data-urlencode "sender=xxxxxxxxx" \                 --data-urlencode "senddate=20260620134400" \                 --data-urlencode "receiver_1=010xxxxxxxx" \                 --data-urlencode "recvname_1=홍길동1" \                 --data-urlencode "subject_1=제목1" \                 --data-urlencode "message_1=내용1" \                 --data-urlencode "button_1: {                                                     button: [{                                                         "name" : 버튼명                                                         "linkType" : AC, DS, WL, AL, BK, MD 중에서 1개                                                         "linkTypeName" : 채널 추가, 배송조회, 웹링크, 앱링크, 봇키워드, 메시지전달 중에서 1개                                                         "linkMo" : 설정한 모바일 링크                                                         "linkPc" : 설정한 PC 링크                                                         "linkIos" : 설정한 IOS Scheme                                                         "linkAnd" : 설정한 Android Scheme                                                     }]                                                 }" \                 --data-urlencode "failover=Y" \                 --data-urlencode "fsubject_1=문자제목1" \                 --data-urlencode "fmessage_1=문자내용1"`
            
            

[Notice]

1. 템플릿에 추가하지 않은 버튼에 대한 정보는 삭제하셔도 무방합니다.

2. 알림톡 내용(message)은 템플릿과 동일하게 개행문자를 입력하셔야 합니다.

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|info|알림톡 전송후 잔여포인트 및 소비단가 정보|Object|

|   |   |   |
|---|---|---|
info 변수 설명
|변수|설명|타입|
|type|AT|String|
|mid|메시지 ID|Integer|
|current|포인트|Float|
|unit|개별전송단가|Float|
|total|전체전송단가|Float|
|scnt|정상적으로 요청된 연락처 갯수|Integer|
|fcnt|잘못 요청된 연락처 갯수|Integer|

알림톡 전송이 성공하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "성공적으로 전송요청 하였습니다."                     "info" : {                             "type": "AT",                             "mid": "XXXXXXXX",                             "current": 0,                             "unit": 0,                             "total": 0,                             "scnt": 0,                             "fcnt": 0                             }                 }`
            

알림톡 전송이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "포인트가 부족합니다."                 }`
            
            

##### 브랜드메시지 템플릿 생성 - TEXT 타입

브랜드 메시지의 TEXT 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형 (값 : TEXT)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|template_content|템플릿 본문 텍스트|O|String|
|template_button|템플릿 버튼|X|String **(버튼 속성 설명)**|
|template_coupon|템플릿 쿠폰|X|String **(쿠폰 속성 설명)**|

  

버튼 속성 설명 (반드시 스트링 타입으로 전달해야 합니다)

|변수|설명|필수|타입|
|---|---|---|---|
|name|버튼명|O|String|
|linkType|버튼의 링크타입  <br>(AC: 채널추가, DS: 배송조회, WL: 웹링크, AL: 앱링크, BK: 봇키워드, MD: 메시지전달)|O|String|
|linkM|모바일 웹링크주소  <br>(http:// 또는 https:// 필수)|WL 일때 필수|String|
|linkP|PC 웹링크주소  <br>(http:// 또는 https:// 필수)|WL 일때 필수|String|
|linkI|IOS 앱링크 주소|AL 일때 필수|String|
|linkA|Android 앱링크 주소|AL 일때 필수|String|

  

쿠폰 속성 설명 (반드시 스트링 타입으로 전달해야 합니다)

- 채널 쿠폰 (포맷:alimtalk=coupon://) 사용시 linkA 또는 linkI 중 한개 필수 입력  
- 채널 쿠폰 URL이 아닌 기본 쿠폰 사용시 linkM 필수 입력

|   |   |   |   |
|---|---|---|---|
|변수|설명|필수|타입|
|title|쿠폰제목 고정 문자열 - 아래 문자열만 사용 가능  <br>type1 : #{할인금액}원 할인 쿠폰 (#{할인금액} : 1 ~ 99,999,999)  <br>type2 : #{할인율}% 할인 쿠폰 (#{할인율} : 1 ~ 100)  <br>type3 : 배송비 할인 쿠폰  <br>type4 : #{상품명} 무료 쿠폰 (#{상품명} : 최대 7자)  <br>type5 : #{상품명} UP 쿠폰 (#{상품명} : 최대 7자)|O|String|
|description|쿠폰 성명  <br>WIDE, WIDE_ITEM_LIST, PREMIUM_VIDEO : 최대 18자  <br>이외의 유형 : 최대 12자|O|String|
|linkM|모바일 웹링크주소  <br>(http:// 또는 https:// 필수)|-|String|
|linkP|PC 웹링크주소  <br>(http:// 또는 https:// 필수)|X|String|
|linkI|모바일 IOS 앱링크 주소|-|String|
|linkA|Android 앱링크 주소|-|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=TEXT" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "template_content=예제 템플릿 내용 입니다." \                 --data-urlencode "template_button=[                     {                         "name": "바로가기",                         "linkType": "WL",                         "linkM": "https:\/\/#{이동링크}",                         "linkP": "https:\/\/#{이동링크}"                     }" \                 --data-urlencode "template_coupon={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"                 }`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "templateCode": "XXXXXXXX",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "TEXT",
        "content": "예제 템플릿 내용 입니다.",
        "adult": false,
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A",
        "buttons": [
            {
                "name": "바로가기",
                "linkType": "WL",
                "linkM": "https:\/\/#{이동링크}",
                "linkP": "https:\/\/#{이동링크}"
            }
        ],
        "coupon": {
            "title": "#{할인금액}원 할인 쿠폰",
            "description": "쿠폰설명 입니다",
            "linkM": "http://#{쿠폰}",
            "linkA": "alimtalk=coupon://#{쿠폰링크}",
            "linkI": "alimtalk=coupon://#{쿠폰링크}"
        }
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - IMAGE, WIDE 타입

브랜드 메시지의 IMAGE 또는 WIDE 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(IMAGE or WIDE)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|template_content|템플릿 본문 텍스트|O|String|
|template_button|템플릿 버튼|X|String **(버튼 속성 설명)**|
|template_coupon|템플릿 쿠폰|X|String **(쿠폰 속성 설명)**|
|image_upload|템플릿 이미지  <br>IMAGE : 800x400 (가로 500 이상)  <br>WIDE : 800x600 (가로 500 이상)|O|JPG,PNG|
|image_link|템플릿 이미지|X|이미지 링크|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=IMAGE" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "template_content=예제 템플릿 내용 입니다." \                 --data-urlencode "template_button=[                     {                         "name": "바로가기",                         "linkType": "WL",                         "linkM": "https:\/\/#{이동링크}",                         "linkP": "https:\/\/#{이동링크}"                     }" \                 --data-urlencode "template_coupon={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"                 } \                 --form "image_upload=@localfilename" \                 --data-urlencode "image_link=https://웹사이트링크" \`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "templateCode": "XXXXXXXX",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "IMAGE",
        "content": "예제 템플릿 내용 입니다.",
        "adult": false,
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A",
        "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
        "buttons": [
            {
                "name": "바로가기",
                "linkType": "WL",
                "linkM": "https:\/\/#{이동링크}",
                "linkP": "https:\/\/#{이동링크}"
            }
        ],
        "coupon": {
            "title": "#{할인금액}원 할인 쿠폰",
            "description": "쿠폰설명 입니다",
            "linkM": "http://#{쿠폰}",
            "linkA": "alimtalk=coupon://#{쿠폰링크}",
            "linkI": "alimtalk=coupon://#{쿠폰링크}"
        }
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - WIDE_ITEM_LIST 타입

브랜드 메시지의 WIDE_ITEM_LIST (와이드 아이템 리스트) 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(WIDE_ITEM_LIST)|O|String|
|template_name|템플릿 이름|O|String|
|template_header|템플릿 헤더  <br>(최소 1자, 최대 20자, 불바꿈 불가)|-|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|main_wide_item|와이드 리스트 첫번째 아이템|O|String|
|main_wide_item_image|와이드 리스트 첫번째 아이템 이미지  <br>가로 500픽셀 이상, 비율 : 세로/가로=0.5|O|JPG, PNG|
|sub_wide_item1 ~ 3|와이드 리스트 아이템 (최소 2개)|-|JPG, PNG|
|sub_wide_item_image1 ~ 3|와이드 리스트 아이템 이미지 (최소 2개)  <br>가로 500픽셀 이상, 비율 : 세로/가로=1|-|JPG, PNG|
|template_button|템플릿 버튼|X|String **(버튼 속성 설명)**|
|template_coupon|템플릿 쿠폰|X|String **(쿠폰 속성 설명)**|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=WIDE_ITEM_LIST" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "template_header=예제 템플릿 헤더 입니다." \                 --data-urlencode "main_wide_item={                     "title": "아이템 제목",                     "imageUrl": "",                     "linkM": "http:\/\/#{메인테스트}",                     "linkP": "http:\/\/#{메인테스트}",                     "linkI": "",                     "linkA": ""                 }" \                 --form "main_wide_item_image=@localfilename" \                 --data-urlencode "sub_wide_item1={                     "title": "서브 아이템 1 제목",                     "imageUrl": "",                     "linkM": "http:\/\/#{테스트1}",                     "linkP": "http:\/\/#{테스트1}",                     "linkI": "",                     "linkA": ""                 }" \                 --form "sub_wide_item_image1=@localfilename" \                 --data-urlencode "sub_wide_item2={                     "title": "서브 아이템 2 제목",                     "imageUrl": "",                     "linkM": "http:\/\/#{테스트2}",                     "linkP": "http:\/\/#{테스트2}",                     "linkI": "",                     "linkA": ""                 }" \                 --form "sub_wide_item_image2=@localfilename" \                 --data-urlencode "sub_wide_item3={                     "title": "서브 아이템 3 제목",                     "imageUrl": "",                     "linkM": "http:\/\/#{테스트3}",                     "linkP": "http:\/\/#{테스트3}",                     "linkI": "",                     "linkA": ""                 }" \                 --form "sub_wide_item_image3=@localfilename" \                 --data-urlencode "template_button=[                     {                         "name": "바로가기",                         "linkType": "WL",                         "linkM": "https:\/\/#{이동링크}",                         "linkP": "https:\/\/#{이동링크}"                     }" \                 --data-urlencode "template_coupon={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"                 }`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "templateCode": "XXXXXXXX",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "IMAGE",
        "adult": false,
        "header": "예제 템플릿 헤더 입니다.",
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A",
        "wideItemList": [
            {
                "title": "아이템 제목",
                "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                "linkM": "http:\/\/#{메인테스트}"
            },
            {
                "title": "서브 아이템 1 제목",
                "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                "linkM": "http:\/\/#{테스트1}"
            },
            {
                "title": "서브 아이템 2 제목",
                "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                "linkM": "http:\/\/#{테스트2}"
            },
            {
                "title": "서브 아이템 3 제목",
                "imageUrl": "https://mud-kage.kakao.com/dn/xxxx/xxxxxx/xxxxxxxx/xxxxxx.jpg",
                "linkM": "http:\/\/#{테스트3}"
            }
        ],
        "buttons": [
            {
                "name": "바로가기",
                "linkType": "WL",
                "linkM": "https:\/\/#{이동링크}",
                "linkP": "https:\/\/#{이동링크}"
            }
        ],
        "coupon": {
            "title": "#{할인금액}원 할인 쿠폰",
            "description": "쿠폰설명 입니다",
            "linkM": "http://#{쿠폰}",
            "linkA": "alimtalk=coupon://#{쿠폰링크}",
            "linkI": "alimtalk=coupon://#{쿠폰링크}"
        }
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - CAROUSEL_FEED 타입

브랜드 메시지의 CAROUSEL_FEED (캐러셀 피드) 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(CAROUSEL_FEED)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|carousel_header|캐러셀 인트로 헤더  <br>(최소 1자, 최대 20자, 불바꿈 불가)|X|String|
|carousel_header_image|캐러셀 인트로 이미지  <br>(800x600 or 800x400)|X|JPG, PNG|
|carousel_list|캐러셀 리스트  <br>(인트로 사용시 최대 5개, 미사용시 최대 6개)|O|String|
|carousel_list_image1 ~ 6|캐러셀 리스트 피드별 이미지  <br>(800x600 or 800x400)|O|JPG,PNG|
|carousel_list_button1 ~ 6|캐러셀 리스트 피드별 버튼  <br>(캐러셀당 최소 1개, 최대 2개)|O|String|
|carousel_list_coupon1 ~ 6|캐러셀 리스트 피드별 쿠폰|X|String|
|carousel_tail|캐러셀 리스트 TAIL|-|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=CAROUSEL_FEED" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "carousel_header={                     "header": "헤더 테스트",                     "content": "헤더컨텐츠",                     "linkM": "http:\/\/#{헤더링크}",                     "linkP": "http:\/\/#{헤더링크}",                     "linkI": "",                     "linkA": ""                 }" \                 --form "carousel_header_image=@localfilename" \                 --data-urlencode "carousel_list=[                     {                         "header": "첫번째 피드 헤더",                         "content": "첫번째 피드 내용"                     },                     {                         "header": "두번째 피드",                         "content": "두번째피드내용"                     }                 ]" \                 --form "carousel_list_image1=@localfilename" \                 --form "carousel_list_image2=@localfilename" \                 --data-urlencode "carousel_list_button1=[                     {                         "name": "1번째 피드",                         "linktype": "wl",                         "linkM": "https:\/\/#{피드링크1}"                     },                     {                         "name": "채널 추가",                         "linktype": "ac"                     }                 ]" \                 --data-urlencode "carousel_list_button2=[                     {                         "name": "2번째 피드",                         "linktype": "wl",                         "linkM": "https:\/\/#{피드링크2}"                     }                 ]" \                 --data-urlencode "carousel_list_coupon1={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰1}",                     "linkp": "http:\/\/#{쿠폰1}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크1}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크1}"                 }" \                 --data-urlencode "carousel_list_coupon2={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰2}",                     "linkp": "http:\/\/#{쿠폰2}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크2}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크2}"                 }" \                 --data-urlencode "carousel_tail={                     "linkM": "http:\/\/www.이동할링크.com"                 }`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "senderKey": "xxxxxxxxxxx",
        "code": "xxxxxxxxxxx",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "CAROUSEL_FEED",
        "adult": false,
        "carousel": {
            "list": [
                {
                    "header": "헤더 테스트",
                    "content": "헤더컨텐츠",
                    "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                    "buttons": [
                        {
                            "name": "1번째 피드",
                            "linkType": "WL",
                            "linkM": "https:\/\/#{피드링크1}"
                        },
                        {
                            "name": "채널 추가",
                            "linkType": "AC"
                        }
                    ],
                    "coupon": {
                        "title": "#{할인금액}원 할인 쿠폰",
                        "description": "쿠폰설명 입니다",
                        "linkM": "http:\/\/#{쿠폰1}",
                        "linkI": "alimtalk=coupon:\/\/#{쿠폰링크1}"
                    }
                },
                {
                    "header": "두",
                    "content": "두번째피드내용",
                    "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                    "buttons": [
                        {
                            "name": "2번째 피드",
                            "linkType": "WL",
                            "linkM": "https:\/\/#{피드링크2}"
                        }
                    ],
                    "coupon": {
                        "title": "#{할인금액}원 할인 쿠폰",
                        "description": "쿠폰설명 입니다",
                        "linkM": "http:\/\/#{쿠폰}",
                        "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}"
                    }
                }
            ],
            "tail": {
                "linkM": "http:\/\/www.이동할링크.com"
            }
        },
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A"
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - PREMIUM_VIDEO 타입

브랜드 메시지의 PREMIUM_VIDEO 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(PREMIUM_VIDEO)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|template_video|카카오 TV 동영상 URL|O|String|
|template_video_thumb|동영상 썸네일용 URL  <br>비공개 동영상일 때 필수|X|String|
|template_content|템플릿 본문 텍스트|O|String|
|template_button|템플릿 버튼|X|String **(버튼 속성 설명)**|
|template_coupon|템플릿 쿠폰|X|String **(쿠폰 속성 설명)**|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=PREMIUM_VIDEO" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "template_content=예제 템플릿 내용 입니다." \                 --data-urlencode "template_video=https://tv.kakao.com/channel/000000/cliplink/00000" \                 --data-urlencode "template_button=[                     {                         "name": "바로가기",                         "linkType": "WL",                         "linkM": "https:\/\/#{이동링크}",                         "linkP": "https:\/\/#{이동링크}"                     }" \                 --data-urlencode "template_coupon={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"                 }`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "senderKey": "XXXXXXXX",
        "code": "XXXXXXXX",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "PREMIUM_VIDEO",
        "content": "예제 템플릿 내용 입니다.",
        "adult": false,
        "video": {
            "videoUrl": "https://tv.kakao.com/channel/000000/cliplink/00000",
            "thumbnailUrl": "http://t1.kakaocdn.net/tvpot/thumb/00000/thumb.png",
            "createdAt": ""
        },
        "createdAt": "",
        "modifiedAt": "",
        "status": "A",
        "buttons": [
            {
                "name": "바로가기",
                "linkType": "WL",
                "linkM": "https:\/\/#{이동링크}",
                "linkP": "https:\/\/#{이동링크}"
            }
        ],
        "coupon": {
            "title": "#{할인금액}원 할인 쿠폰",
            "description": "쿠폰설명 입니다",
            "linkM": "http:\/\/#{쿠폰}",
            "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",
            "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"
        }
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - COMMERCE 타입

브랜드 메시지의 COMMERCE 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(COMMERCE)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|template_commerce|커머스 요소  <br>title : 상품 제목 (필수, 줄바꿈 문자 입력 불가. 변수 가능)  <br>regularPrice : 정상가격 (변수 : #{정상가격} 고정됨)  <br>discountPrice : 할인 후 가격 (변수 : #{할인가격} 고정됨)  <br>discountRate : 할인율 (변수 : #{할인율} 고정됨)  <br>discountFixed : 정액 할인 가격 (변수 : #{정액할인가격} 고정됨)|O|String|
|template_button|템플릿 버튼|X|String **(버튼 속성 설명)**|
|template_coupon|템플릿 쿠폰|X|String **(쿠폰 속성 설명)**|
|image_upload|템플릿 이미지  <br>800x400 또는 800x400|O|JPG,PNG|
|image_link|템플릿 이미지|X|이미지 링크|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=COMMERCE" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "template_commerce={                     "title": "상품제목",                     "regularPrice": "#{정상가격}",                     "discountPrice": "#{할인가격}",                     "discountRate": "#{할인율}",                     "discountFixed": "#{정액할인가격}"                 }" \                 --data-urlencode "template_button=[                     {                         "name": "바로가기",                         "linkType": "WL",                         "linkM": "https:\/\/#{이동링크}",                         "linkP": "https:\/\/#{이동링크}"                     }" \                 --data-urlencode "template_coupon={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크}"                 } \                 --form "image_upload=@localfilename" \                 --data-urlencode "image_link=https://웹사이트링크"`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "senderKey": "XXXXXXXX",
        "code": "XXXXXXXX",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "COMMERCE",
        "adult": false,
        "imageLink": "https://웹사이트링크",
        "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
        "commerce": {
            "title": "상품제목",
            "regularPrice": #{정상가격},
            "discountPrice": #{할인가격},
            "discountRate": #{할인율},
            "discountRate": #{정액할인가격}
        },
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A",
        "buttons": [
            {
                "name": "바로가기",
                "linkType": "WL",
                "linkM": "https:\/\/#{이동링크}",
                "linkP": "https:\/\/#{이동링크}"
            }
        ],
        "coupon": {
            "title": "#{할인금액}원 할인 쿠폰",
            "description": "쿠폰설명 입니다",
            "linkM": "http:\/\/#{쿠폰}",
            "linkI": "alimtalk=coupon:\/\/#{쿠폰링크}"
        }
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드메시지 템플릿 생성 - CAROUSEL_COMMERCE 타입

브랜드 메시지의 CAROUSEL_COMMERCE (캐러셀 커머스) 타입 템플릿을 생성 합니다.

[ Request ]

                `POST /brandtalk/template/create/ HTTP/1.1                         Host: kakaoapi.aligo.in                         Service Port: 443`
                
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|template_type|생성할 템플릿 유형  <br>(CAROUSEL_COMMERCE)|O|String|
|template_name|템플릿 이름|O|String|
|adult|성인여부|O|Y or N (기본값 : N)|
|carousel_header|캐러셀 커머스 헤더|X|String|
|carousel_header_image|캐러셀 인트로 이미지  <br>(800x600 or 800x400)|X|JPG, PNG|
|carousel_list|캐러셀 리스트 부가정보|O|String|
|carousel_list_commerce1 ~ 6|피드별 커머스 요소  <br>title : 상품 제목 (필수, 줄바꿈 문자 입력 불가. 변수 가능)  <br>regularPrice : 정상가격 (변수 : #{정상가격} 고정됨)  <br>discountPrice : 할인 후 가격 (변수 : #{할인가격} 고정됨)  <br>discountRate : 할인율 (변수 : #{할인율} 고정됨)  <br>discountFixed : 정액 할인 가격 (변수 : #{정액할인가격} 고정됨)|O|String|
|carousel_list_image1 ~ 6|캐러셀 리스트 피드별 이미지  <br>(800x600 or 800x400)|O|JPG,PNG|
|carousel_list_button1 ~ 6|캐러셀 리스트 피드별 버튼  <br>(캐러셀당 최소 1개, 최대 2개)|O|String|
|carousel_list_coupon1 ~ 6|캐러셀 리스트 피드별 쿠폰|X|String|
|carousel_tail|캐러셀 리스트 TAIL|-|String|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/create/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "senderkey=xxxxxxxxxx" \                 --data-urlencode "template_type=CAROUSEL_COMMERCE" \                 --data-urlencode "template_name=예제 템플릿 제목 입니다." \                 --data-urlencode "adult=N" \                 --data-urlencode "carousel_header={                     "header": "헤더 테스트",                     "content": "헤더컨텐츠",                     "linkM": "http:\/\/#{헤더링크}",                     "linkP": "http:\/\/#{헤더링크}"                 }" \                 --form "carousel_header_image=@localfilename" \                 --data-urlencode "carousel_list=[                     {                         "additionalcontent": "커머스 부가정보 텍스트 1"                     },                     {                         "additionalcontent": "커머스 부가정보 텍스트 2"                     }                 ]" \                  --data-urlencode "carousel_list_commerce1={                     "title": "상품제목",                     "regularPrice": "#{정상가격}",                     "discountPrice": "#{할인가격}",                     "discountRate": "#{할인율}",                     "discountFixed": "#{정액할인가격}"                 }" \                 --data-urlencode "carousel_list_commerce2={                     "title": "상품제목",                     "regularPrice": "#{정상가격}",                     "discountPrice": "#{할인가격}",                     "discountRate": "#{할인율}",                     "discountFixed": "#{정액할인가격}"                 }" \                  --form "carousel_list_image1=@localfilename" \                 --form "carousel_list_image2=@localfilename" \                 --data-urlencode "carousel_list_button1=[                     {                         "name": "1번째 피드",                         "linktype": "wl",                         "linkM": "https:\/\/#{피드링크1}"                     },                     {                         "name": "채널 추가",                         "linktype": "ac"                     }                 ]" \                 --data-urlencode "carousel_list_button2=[                     {                         "name": "2번째 피드",                         "linktype": "wl",                         "linkM": "https:\/\/#{피드링크2}"                     }                 ]" \                 --data-urlencode "carousel_list_coupon1={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰1}",                     "linkp": "http:\/\/#{쿠폰1}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크1}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크1}"                 }" \                 --data-urlencode "carousel_list_coupon2={                     "title": "type1",                     "description": "쿠폰설명 입니다",                     "linkM": "http:\/\/#{쿠폰2}",                     "linkp": "http:\/\/#{쿠폰2}",                     "linkI": "alimtalk=coupon:\/\/#{쿠폰링크2}",                     "linkA": "alimtalk=coupon:\/\/#{쿠폰링크2}"                 }" \                 --data-urlencode "carousel_tail={                     "linkM": "http:\/\/www.이동할링크.com"                 }`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(성공일때 무조껀 1 이외는 모두 실패)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|data|템플릿 생성요청 결과|Object|

data 반환정보 설명

```
{
    "code": 1,
    "data": {
        "senderKey": "xxxxxxxxxx",
        "code": "xxxxxxxxxx",
        "name": "예제 템플릿 제목 입니다.",
        "chatBubbleType": "CAROUSEL_COMMERCE",
        "adult": false,
        "carousel": {
            "head": {
                "header": "헤더 테스트",
                "content": "헤더컨텐츠",
                "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                "linkM": "http:\/\/#{헤더링크}",
                "linkP": "http:\/\/#{헤더링크}"
            },
            "list": [
                {
                    "additionalContent": "커머스 부가정보 텍스트 1",
                    "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                    "commerce": {
                        "title": "상품제목",
                        "regularPrice": #{정상가격},
                        "discountPrice": #{할인가격},
                        "discountRate": #{할인율},
                        "discountFixed": #{정액할인가격}
                    },
                    "buttons": [
                        {
                            "name": "1번째 피드",
                            "linkType": "WL",
                            "linkM": "https:\/\/#{피드링크1}"
                        },
                        {
                            "name": "채널 추가",
                            "linkType": "AC"
                        }
                    ],
                    "coupon": {
                        "title": "#{할인금액}원 할인 쿠폰",
                        "description": "쿠폰설명 입니다",
                        "linkM": "http:\/\/#{쿠폰1}",
                        "linkP": "http:\/\/#{쿠폰1}",
                        "linkI": "alimtalk=coupon:\/\/#{쿠폰링크1}",
                        "linkA": "alimtalk=coupon:\/\/#{쿠폰링크1}"
                    }
                },
                {
                    "additionalContent": "커머스 부가정보 텍스트 2",
                    "imageUrl": "http://mud-kage.kakao.com/dn/0000/0000/00000000000000000/img.png",
                    "commerce": {
                        "title": "상품제목",
                        "regularPrice": #{정상가격},
                        "discountPrice": #{할인가격},
                        "discountRate": #{할인율},
                        "discountFixed": #{정액할인가격}
                    },
                    "buttons": [
                        {
                            "name": "2번째 피드",
                            "linkType": "WL",
                            "linkM": "https:\/\/#{피드링크2}"
                        }
                    ],
                    "coupon": {
                        "title": "#{할인금액}원 할인 쿠폰",
                        "description": "쿠폰설명 입니다",
                        "linkM": "http:\/\/#{쿠폰2}",
                        "linkP": "http:\/\/#{쿠폰2}",
                        "linkI": "alimtalk=coupon:\/\/#{쿠폰링크2}",
                        "linkA": "alimtalk=coupon:\/\/#{쿠폰링크2}"
                    }
                }
            ],
            "tail": {
                "linkM": "http:\/\/www.이동할링크.com"
            }
        },
        "createdAt": "2026-06-20 13:34:17",
        "modifiedAt": "2026-06-20 13:34:17",
        "status": "A"
    },
    "message": "템플릿을 생성하였습니다."
}
```

##### 브랜드 메시지 템플릿 조회

생성한 브랜드 메시지의 템플릿을 조회 합니다.

[ Request ]

    `POST /brandtalk/template/list/ HTTP/1.1             Host: kakaoapi.aligo.in             Service Port: 443`
    
    

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|senderkey|발신프로필 키|O|String|
|page|조회 페이지 (미입력시 기본 : 1)|O|Integer|
|pageSize|노출 목록 갯수 (미입력시 기본 : 200, 최대 : 1000)|O|Integer|

예를 들면,

    `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/list/" \         --data-urlencode "apikey=xxxxx" \         --data-urlencode "userid=xxxxx" \         --data-urlencode "senderkey=xxxxxxxxx" \         --data-urlencode "page=1" \         --data-urlencode "pageSize=200"`
    
    

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|pageInfo|페이지 정보|Object|
|- nextYn|다음 페이지 존재 유무|Y or N|
|- page|현재 페이지|Integer|
|- pageSize|페이지당 노출 갯수|Integer|
|data|브랜드 메시지 템플릿 목록|Object|
|- templateCode|브랜드 메시지 템플릿 코드|String|
|- templateName|브랜드 메시지 템플릿 이름|String|
|- templateType|브랜드 메시지 템플릿 유형|String|
|- templateStatus|브랜드 메시지 템플릿 상태코드  <br>(A : 등록, S : 차단)|String|
|- send_variable|브랜드 메시지 템플릿 발송변수|Array|
|- create_at|브랜드 메시지 템플릿 생성일자|Datetime|

정상적으로 성공했을 경우

    `HTTP/1.1 200 OK         Content-Type: application/json;charset=UTF-8         {             "code": 1             "message": "정상적으로 호출하였습니다."             "pageInfo": {                 "nextYn": "N",                 "page": 1,                 "pageSize": 200             }             "data": [{                 "templateCode" : "AAAA0000",                 "templtName": "템플릿 예제 제목",                 "templateType": "TEXT",                 "templateStatus": "A",                 "templateStatusLabel": "등록",                 "send_variable": [                     "#{치환자1}",                     "#{치환자2}",                     "#{치환자3}",                     "#{치환자4}"                 ],                 "create_at": "2026-06-20 13:34:17"             }]         }`
    

##### 브랜드메시지 전송

브랜드메시지 전송을 요청합니다.

[ Request ]

            `POST /brandtalk/template/send/ HTTP/1.1                     Host: kakaoapi.aligo.in                     Service Port: 443`
            
            

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|sender|발신자 연락처|O|String|
|senddate|예약일|X|datetime|
|advert_yn|광고분류|X|Y or N (기본 Y)|
|kakao_target|타켓팅 설정  <br>M : 광고주 마수동 유저(카카오톡 수신 동의)  <br>N : 광고주 마수동 유저(카카오톡 수신동의) – 채널 친구  <br>I : 광고주 발송 요청 대상 ∩ 채널 친구 (교집합)|O|String|
|receiver_1 (1 ~ 500)|수신자 휴대폰 번호|O|String|
|receiver_1_message (1 ~ 500)|수신자 치환 메시지  <br>브랜드 메시지 템플릿 조회 API  <br>send_variable 문자열|O|String|
|failoverYn|실패시 대체문자 전송기능|X|Y or N (기본 N)|
|failover_type|대체문자 메시지 유형|O|SMS, LMS, MMS|
|failover_subject1 (1 ~ 500)|실패시 대체문자 제목|X|String|
|failover_content1 (1 ~ 500)|실패시 대체문자 내용|X|String|
|failover_mms1|MMS 일때 첫번째 이미지|X|JPG,PNG|
|failover_mms2|MMS 일때 두번째 이미지|X|JPG,PNG|
|failover_mms3|MMS 일때 세번째 이미지|X|JPG,PNG|

예를 들면,

            `curl -X POST "https://kakaoapi.aligo.in/brandtalk/template/send/" \                 --data-urlencode "apikey=xxxxx" \                 --data-urlencode "userid=xxxxx" \                 --data-urlencode "template_code=xxxxxxxxxx" \                 --data-urlencode "sender=xxxxxxxxx" \                 --data-urlencode "senddate=20260620134400" \                 --data-urlencode "advert=Y" \                 --data-urlencode "kakao_target=I" \                 --data-urlencode "receiver_1=010xxxxxxxx" \                 --data-urlencode "receiver_1_message={                         "#{기업명}": "알리고",                         "#{인삿말}": "안녕하세요"                     }" \                 --data-urlencode "failoverYn=Y" \                 --data-urlencode "failover_type=MMS" \                 --data-urlencode "failover_subject1=대체문자제목1" \                 --data-urlencode "failover_content2=대체문자내용1" \                 --form failover_mms1=@localfilename \                 --form failover_mms2=@localfilename \                 --form failover_mms3=@localfilename`
            
            

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|API 호출에 대한 결과 메시지|String|
|info|브랜드메시지 전송 후 잔여포인트 및 소비단가 정보|Object|

|   |   |   |
|---|---|---|
info 변수 설명
|변수|설명|타입|
|type|FT|String|
|mid|메시지 ID|Integer|
|current|잔여 포인트|Float|
|costType|차감 유형  <br>(BWF : 친구단가, BNF : 비친구단가)|Strung|
|unitCost|개별전송단가|Float|
|totalCost|전체전송단가|Float|
|scnt|정상적으로 요청된 연락처 개수|Integer|
|fcnt|잘못 작성한 연락처 개수|Integer|

브랜드메시지 전송이 성공하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": 0                     "message": "성공적으로 전송요청 하였습니다."                     "info" : {                             "type": "FT",                             "mid": "XXXXXXXX",                             "current": 0,                             "unitCost": 0,                             "totalCost": 0,                             "scnt": 0,                             "fcnt": 0                             }                 }`
            

브랜드메시지 전송이 실패하였을 경우

            `HTTP/1.1 200 OK                 Content-Type: application/json;charset=UTF-8                 {                     "code": -99                     "message": "포인트가 부족합니다."                 }`
            
            

 

##### 전송내역조회

최근 요청및 처리된 전송내역을 조회하실 수 있습니다. 사이트내 전송결과조회 페이지와 동일한 내역이 조회되며, 날짜기준으로 조회가 가능합니다. 발신번호별 조회기능은 제공이 되지 않습니다. 조회시작일을 지정하실 수 있으며, 시작일 이전 몇일까지 조회할지 설정이 가능합니다. 조회시 최근발송내역 순서로 소팅됩니다.

[ Request ]

```
POST /akv10/history/list/ HTTP/1.1
	Host: kakaoapi.aligo.in
	Service Port: 443
```

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|page|페이지번호|X(기본 1)|Integer|
|limit|페이지당 출력갯수|X(기본 50) 50~500|Integer|
|startdate|조회시작일자|X(기본 최근일자)|YYYYMMDD|
|enddate|조회마감일자|X|YYYYMMDD|

오늘기준 7일전 전송내역 조회를 예로 들면,

```
curl -X POST "https://kakaoapi.aligo.in/akv10/history/list/" \
	--data-urlencode "apikey=xxxxx" \
	--data-urlencode "userid=xxxxx" \
	--data-urlencode "page=1" \
	--data-urlencode "limit=50" \
	--data-urlencode "startdate=20260520" \
	--data-urlencode "enddate=20260620"
```

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|결과 메시지( code 가 0 이 아닌경우 실패사유 표기)|String|
|list|목록 배열|Array|
|currentPage|현재 페이지|Integer|
|totalPage|전체 페이지|Integer|
|totalCount|전체 메시지 갯수|Integer|

|   |   |   |
|---|---|---|
list 배열
|변수|설명|타입|
|mid|메시지ID|Integer|
|type|문자구분(유형)|String|
|sender|발신번호|String|
|msg_count|전송요청수|Integer|
|mbody|메시지내용|String|
|reserve_date|메시지 예약일|String|
|reserve_state|메시지 상태|String|
|regdate|등록일|String|

최근 발송된 건을 조회한 경우를 예로들면,

```
HTTP/1.1 200 OK
	Content-Type: application/json;charset=UTF-8
	{
	    "code": 0
	    "message": "정상적으로 호출하였습니다."
	    "list": [{
			"mid": "123456788"
			"type": "AT"
			"sender": "025114560"
			"msg_count": "1"
			"reserve_date": "20260620133417"
			"reserve_state": "예약대기중"
			"mbody": "API 전송테스트 입니다."
			"reg_date": "2026-06-20 12:59:17"
			}]
	    "currentPage": "1"
        "totalPage": "1"
        "totalCount": "1"
	}
```

전송요청이 실패한 경우를 예로들면,

```
HTTP/1.1 200 OK
	Content-Type: application/json;charset=UTF-8
	{
	"code": -99
	"message": "인증오류입니다."
	}
```

 

##### 전송결과조회(상세)

API에서 조회되는 mid를 사용하여 수신번호별 상태를 조회하실 수 있습니다. 수신전화번호별 전송상태를 조회하실 수 있으며 목록에 없거나 전송중인 문자는 만24시간동안 전송시도중인것입니다. 최종 24시간이 경과 후 조회하셔야 완료된 내역을 확인하실 수 있습니다.

[ Request ]

```
POST /akv10/history/detail/ HTTP/1.1
	Host: kakaoapi.aligo.in
	Service Port: 443
```

https 프로토콜을 사용하여 POST로 요청합니다. 통신사에 전달 후 전송결과가 통보되지 않은 경우에는 목록에 나오지 않거나, 전송중으로 나올 수 있습니다. 24시간 후 최종 결과를 확인하시기 바랍니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|
|mid|메시지 고유ID|O|Integer|
|page|페이지번호|X(기본 1)|Integer|
|limit|페이지당 출력갯수|X(기본 50) 50~500|Integer|

mid 123456789 의 전송결과 상세 조회를 예로 들면,

```
curl -X POST "https://kakaoapi.aligo.in/akv10/history/detail/" \
	--data-urlencode "userid=xxxxx" \
	--data-urlencode "apikey=xxxxx" \
	--data-urlencode "mid=123456678" \
	--data-urlencode "page=1" \
	--data-urlencode "limit=50"
```

[Response]

응답 바디는 JSON 객체로 구성됩니다.

|   |   |   |
|---|---|---|
JSON
|변수|설명|타입|
|code|결과코드(API 수신유무)|Integer|
|message|결과 메시지( code 가 0 이 아닌경우 실패사유 표기)|String|
|list|목록 배열|Array|
|currentPage|현재 페이지|Integer|
|totalPage|전체 페이지|Integer|
|totalCount|전체 메시지 갯수|Integer|

|   |   |   |
|---|---|---|
list 배열
|변수|설명|타입|
|msgid|메시지 상세ID (전송중인 경우 앞에 "Q" 가 붙음)|String|
|type|문자구분(유형)|String|
|sender|발신번호|String|
|phone|수신번호|String|
|status|메시지 상태  <br>(2 : 카카오 인식불가 번호포맷, 3 : 카카오 인식가능 번호포맷)|Integer|
|reqdate|요청일|YYYY-MM-DD HH:ii:ss|
|sentdate|전송일|YYYY-MM-DD HH:ii:ss|
|rsltdate|응답일|YYYY-MM-DD HH:ii:ss|
|reportdate|결과값갱신일|YYYY-MM-DD HH:ii:ss|
|rslt|상태|String|
|rslt_message|사유|String|
|message|전송한 내용|String|
|button_json|버튼내용|String|
|tpl_code|템플릿 코드|String|
|senderKey|프로파일키|String|
|smid|대체문자 전송시 mid|Integer|

최근 발송된 메시지를 조회한 경우를 예로들면,

```
HTTP/1.1 200 OK
	Content-Type: application/json;charset=UTF-8
	{
	    "code": 0
	    "message": "정상적으로 호출하였습니다."
	    "list": [{
			"msgid": "123456788",
			"type": "AT",
			"sender": "025114560",
			"phone": "010XXXXXXXX",
			"status": "3",
			"reqdate": "2026-06-20 13:34:17",
			"sentdate": "2026-06-20 13:34:17",
			"rsltdate": "2026-06-20 13:34:17",
			"reportdate": "2026-06-20 13:34:17",
			"rslt": "U",
			"rslt_message": "메시지가 템플릿과 일치하지않음",
			"message": "API 전송테스트 입니다.",
			"button_json": "{}",
			"tpl_code": "XXXXXXX",
			"senderKey": "XXXXXXX",
			"smid": "0"
			}]
	    "currentPage": "1",
	    "totalPage": "1",
	    "totalCount": "1"
	}
```

전송요청이 실패한 경우를 예로들면,

```
HTTP/1.1 200 OK
	Content-Type: application/json;charset=UTF-8
	{
	"code": -101
	"message": "인증오류입니다."
	}
```

 

##### 발송가능건수

보유한 잔여포인트로 발송가능한 잔여건수를 문자구분(유형)별로 조회하실 수 있습니다. SMS, LMS, MMS, ALT 로 발송시 가능한 잔여건수이며 남은 충전금을 문자유형별로 보냈을 경우 가능한 잔여건입니다. 예를들어 SMS_CNT : 11 , ALT_CNT : 15 인 경우 단문전송시 11건이 가능하고, 알림톡으로 전송시 15건이 가능합니다.

[ Request ]

```
POST /akv10/heartinfo/ HTTP/1.1
	Host: kakaoapi.aligo.in
	Service Port: 443
```

https 프로토콜을 사용하여 POST로 요청합니다.

|변수|설명|필수|타입|
|---|---|---|---|
|apikey|인증용 API Key|O|String|
|userid|사용자id|O|String|

예를 들면,

```
curl -X POST "https://kakaoapi.aligo.in/akv10/heartinfo/" \
	--data-urlencode "userid=xxxxx" \
	--data-urlencode "apikey=xxxxx"
```

``   [Response]  응답 바디는 JSON 객체로 구성됩니다.  |   |   |   | |---|---|---| JSON |변수|설명|타입| |result_code|결과코드(API 수신유무)|Integer| |message|결과 메시지( result_code 가 0 보다 작은경우 실패사유 표기)|String| |SMS_CNT|단문전송시 발송가능한건수|Integer| |LMS_CNT|단문전송시 발송가능한건수|Integer| |MMS_CNT|그림(사진)전송시 발송가능한건수|Integer| |ALT_CNT|알림톡 전송시 발송가능한건수|Integer|  조회에 성공한 경우를 예로들면,  ``` HTTP/1.1 200 OK 	Content-Type: application/json;charset=UTF-8 	{ 	    "code": 1 	    "message": ""         "list" : {             "SMS_CNT": 5555             "LMS_CNT": 1930             "MMS_CNT": 833         } 	} ```  전송요청이 실패한 경우를 예로들면,  ``` HTTP/1.1 200 OK 	Content-Type: application/json;charset=UTF-8 	{ 	    "code": -99 	    "message": "인증오류입니다." 	} ```     ##### 예약문자 취소  API를 통해 예약한 내역을 전송취소할 수 있습니다. 예약취소는 발송전 5분이전의 문자만 가능합니다.  [ Request ]  ``` POST /akv10/cancel/ HTTP/1.1 	Host: kakaoapi.aligo.in 	Service Port: 443 ```  https 프로토콜을 사용하여 POST로 요청합니다.  |변수|설명|필수|타입| |---|---|---|---| |apikey|인증용 API Key|O|String| |userid|사용자id|O|String| |mid|메시지ID|O|Integer|  예를 들면,  ``` curl -X POST "https://kakaoapi.aligo.in/akv10/cancel/" \ 	--data-urlencode "userid=xxxxx" \ 	--data-urlencode "apikey=xxxxx" \ 	--data-urlencode "mid=123456789" ```  [Response]  응답 바디는 JSON 객체로 구성됩니다.  |   |   |   | |---|---|---| JSON |변수|설명|타입| |code|결과코드(API 수신유무)|Integer| |message|결과 메시지( result_code 가 0 이 아닌 경우 실패사유 표기)|String|  정상취소가 완료된 경우를 예로들면,  ``` HTTP/1.1 200 OK 	Content-Type: application/json;charset=UTF-8 	{ 		    "code": 1 		    "message": "" 	} ```  전송요청이 실패한 경우를 예로들면,          `HTTP/1.1 200 OK             Content-Type: application/json;charset=UTF-8             {                 "code": -99                 "message": "발송 5분전까지만 취소가 가능합니다."             }`           연동형 API로 처리 실패시 message 항목의 안내문구를 참고하여 주시기 바랍니다.   ``