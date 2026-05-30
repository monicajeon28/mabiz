import urllib

from django.http import HttpResponse

from django.shortcuts import redirect
from pip._vendor.appdirs import unicode


def rootIndexPage (request):
    
    return redirect("/pay/");

def index(request):
    print("index")
    return HttpResponse("index")

# 페이앱 결제 요청
def payrequest(request):
    post_data = ({'cmd': 'payrequest', 'userid': '판매자 회원 아이디', 'goodname': '상품명', 'price': '결제요청 금액','recvphone': '수신 휴대폰번호'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        #state=1 이면 성공
        #state=0 이면 오류


    return HttpResponse(resp)
    

# 결제 (요청, 승인) 취소
def payRequestCancel(request):

    # 부분취소를 하려면 아래 parameter 값을 추가해서전달한다.
    # 'partcancel': "1", // partcancel 결제요청취소 구분(0: 전취소, 1: 부분취소)
    # 'cancelprice': "1000", // cancelprice 결제요청취소 금액(부분취소인 경우 필수)

    #cancelmode 가 ready인 경우 결제요청 상태만 취소가능
    post_data = ({'cmd': 'paycancel', 'userid': '판매자 회원 아이디', 'linkkey': '연동 KEY (필수)', 'mul_no': '결제요청번호','cancelmode': 'ready'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)

# 결제 취소
def payRequestCancel2(request):


    # 부분취소를 하려면 아래 parameter 값을 추가해서전달한다.
    # 'partcancel': "1", // partcancel 결제요청취소 구분(0: 전취소, 1: 부분취소)
    # 'cancelprice': "1000", // cancelprice 결제요청취소 금액(부분취소인 경우 필수)

    post_data = ({'cmd': 'paycancel', 'userid': '판매자 회원 아이디', 'linkkey': '연동 KEY (필수)', 'mul_no': '결제요청번호'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)


# 페이앱 정기결제 요청
def payRegularRequest(request):
    
    post_data = ({'cmd': 'rebillRegist', 'userid': '판매자 회원 아이디', 'goodname': '상품명', 'goodprice': '결제요청 금액','recvphone': '수신 휴대폰번호',
                  'rebillCycleType' : '정기 결제 타입 ( Month,Week,Day ) 예 : Month','rebillCycleMonth' : '월 정기결제 결제일 (1~31,90:말일) 예 : 20',
                  'rebillExpire' : '정기결제 만료일 (yyyy-mm-dd) 예 : 2022-09-01'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")


    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read()).decode("utf8")

        #state=1 이면 성공
        #state=0 이면 오류

    return HttpResponse(resp)


# 정기 결제 취소 요청
def payRegularRequestCancel(request):
    post_data = ({'cmd': 'rebillCancel', 'userid': '판매자 회원 아이디', 'linkkey': '연동 KEY (필수)', 'rebill_no': '정기결제요청번호'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)


# 부계정 연동
def subidRegist(request):
    post_data = ({'cmd': 'subidregist', 'userid': '판매자 회원 아이디', 'subuserid': '부계정 아이디 (필수)', 'subpwd': '부계정 비밀번호 (필수)',
                  'subname': '부계정명 (필수)'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")

    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read()).decode("utf8")

        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)


# 현금 영수증 발행 요청
def payappCashSt(request):
    post_data = ({'cmd': 'cashSt', 'userid': '판매자 회원 아이디', 'goodname': '상품명', 'buyr_name': '구매자명 (필수)','buyr_tel1': '구매자 휴대폰',
                  'buyr_mail' : '구매자 이메일','id_info' : '휴대폰번호 또는 사업자번호 (필수)','trad_time' : '원거래시각 (필수)',
                  'tr_code': '발행용도(0:소득공제용, 1:지출증빙용) (필수)','amt_tot' : '거래금액 (필수)','amt_sup' : '공급가액 (필수)','amt_svc' : '봉사료 (필수)',
                  'amt_tax': '부가가치세 (필수)', 'corp_tax_type' : '과세:TG01, 면세:TG02 (필수)'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)


# 현금 영수증 발행 취소 요청
def payappCashStCn(request):
    post_data = ({'cmd': 'cashStCn', 'userid': '판매자 회원 아이디', 'cashstno': '발행번호 (필수)'})  # a sequence of two element tuples
    data = urllib.parse.urlencode(post_data).encode("utf-8")
    req = urllib.request.Request("http://api.payapp.kr/oapi/apiLoad.html")
    with urllib.request.urlopen(req, data=data) as f:
        resp = urllib.parse.unquote_to_bytes(f.read())
        # state=1 이면 성공
        # state=0 이면 오류

    return HttpResponse(resp)