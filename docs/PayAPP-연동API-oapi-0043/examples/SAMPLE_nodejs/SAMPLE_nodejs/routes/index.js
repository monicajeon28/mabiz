var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * 결제 요청
 */
router.get('/payRequest', function(req, res, next) {
  payRequest();
  res.render('test', { title: 'Express' });

});

/**
 * 정기 결제 요청
 */
router.get('/payRegularRequest', function(req, res, next) {
    payRegularRequest();
    res.render('test', { title: 'Express' });

});

/**
 * 정기 결제 취소 요청
 */
router.get('/payRegularRequestCancel', function(req, res, next) {
    payRegularRequestCancel();
    res.render('test', { title: 'Express' });

});


/**
 * 결제 (요청, 승인) 취소
 */
router.get('/payRequestCancel', function(req, res, next) {
    payRequestCancel();
    res.render('test', { title: 'Express' });

});

/**
 * 결제 취소 요청
 */
router.get('/payRequestCancel2', function(req, res, next) {
    payRequestCancel2();
    res.render('test', { title: 'Express' });

});

/**
 * 부계정 등록
 */
router.get('/subidRegist', function(req, res, next) {
    subidRegist();
    res.render('test', { title: 'Express' });

});
/**
 * 현금 영수증 발행
 */
router.get('/payappCashStCn', function(req, res, next) {
    payappCashStCn();
    res.render('test', { title: 'Express' });

});

/**
 * 현금 영수증 발행 취소
 */
router.get('/payappCashSt', function(req, res, next) {
    payappCashSt();
    res.render('test', { title: 'Express' });

});


var http = require('http');
var querystring = require('querystring');

/**
 * 결제 요청
 */
function payRequest() {
  var postData = querystring.stringify({
    'cmd' : 'payrequest',
    'userid' : '판매자 회원 아이디',
    'goodname' : '상품명',
    'price' : '결제요청 금액',
    'recvphone' : '수신 휴대폰번호',
    'feedbackurl' : 'callback'
  });

  var request = http.request(optionsMake(postData), readJSONResponse);

  request.write(postData);
  request.end();
}

/**
 * 결제 (요청, 승인) 취소
 */
function payRequestCancel() {
    var postData = querystring.stringify({
        'cmd' : 'paycancel',
        'userid' : '판매자 회원 아이디',
        'linkkey' : '연동 KEY (필수)',
        'mul_no' : '결제요청번호', // 결제요청번호 (필수)
        'cancelmode' : 'ready', //값이 ready 인 경우 결제요청 상태만 취소 가능),
        'feedbackurl' : 'callback'

        // 부분 취소를 하려면 아래 parameter 값을 추가해서 전달한다.
        //'partcancel' : "1", //partcancel 결제요청취소 구분 (0:전취소, 1:부분취소)
        //'cancelprice' : "1000", //cancelprice 결제요청취소 금액 (부분취소인 경우 필수)
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}
/**
 * 결제 취소 요청
 */
function payRequestCancel2() {
    var postData = querystring.stringify({
        'cmd' : 'paycancel',
        'userid' : '판매자 회원 아이디',
        'linkkey' : '연동 KEY (필수)',
        'mul_no' : '결제요청번호', // 결제요청번호 (필수)
        'feedbackurl' : 'callback'

        // 부분 취소를 하려면 아래 parameter 값을 추가해서 전달한다.
        //'partcancel' : "1", //partcancel 결제요청취소 구분 (0:전취소, 1:부분취소)
        //'cancelprice' : "1000", //cancelprice 결제요청취소 금액 (부분취소인 경우 필수)
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * 정기 결제 요청
 */
function payRegularRequest() {
    var postData = querystring.stringify({
        'cmd' : 'rebillRegist',
        'userid' : '판매자 회원 아이디',
        'goodname' : '상품명',
        'goodprice' : '결제요청 금액',
        'recvphone' : '수신 휴대폰번호',
        'rebillCycleType' : '정기 결제 타입 ( Month,Week,Day ) 예 : Month',
        'rebillCycleMonth' : '월 정기결제 결제일 (1~31,90:말일) 예 : 20',
        'rebillExpire' : '정기결제 만료일 (yyyy-mm-dd) 예 : 2022-09-01',
        'feedbackurl' : 'callback'
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * 정기 결제 취소 요청
 */
function payRegularRequestCancel() {
    var postData = querystring.stringify({
        'cmd' : 'rebillCancel',
        'userid' : '판매자 회원 아이디',
        'linkkey' : '연동 KEY (필수)',
        'rebill_no' : '정기 결제 요청번호', // 정기 결제 요청번호 (필수)
        'feedbackurl' : 'callback'
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * 부계정 연동
 */
function subidRegist() {
    var postData = querystring.stringify({
        'cmd' : 'subidregist',
        'userid' : '판매자 회원 아이디',
        'subuserid' : '부계정 아이디 (필수)',
        'subpwd' : '부계정 비밀번호 (필수)',
        'subname' : '부계정명 (필수)',
        'feedbackurl' : 'callback'
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * 현금 영수증 발행
 */
function payappCashSt() {
    var postData = querystring.stringify({
        'cmd' : 'cashSt',
        'userid' : '판매자 회원 아이디',
        'good_name' : '상품명 (필수)',
        'buyr_name' : '구매자명 (필수)',
        'buyr_tel1' : '구매자 휴대폰',
        'buyr_mail' : '구매자 이메일',
        'id_info' : '휴대폰번호 또는 사업자번호 (필수)',
        'trad_time' : '원거래시각 (필수)',
        'tr_code' : '발행용도(0:소득공제용, 1:지출증빙용) (필수)',
        'amt_tot' : '거래금액 (필수)',
        'amt_sup' : '공급가액 (필수)',
        'amt_svc' : '봉사료 (필수)',
        'amt_tax' : '부가가치세 (필수)',
        'corp_tax_type' : '과세:TG01, 면세:TG02 (필수)',
        'feedbackurl' : 'callback'
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * 현금 영수증 발행 취소
 */
function payappCashStCn() {
    var postData = querystring.stringify({
        'cmd' : 'cashStCn',
        'userid' : '판매자 회원 아이디',
        'cashstno' : '발행번호 (필수)',
        'feedbackurl' : 'callback'
    });

    var request = http.request(optionsMake(postData), readJSONResponse);

    request.write(postData);
    request.end();
}

/**
 * http 정보
 * @param postData
 */
function optionsMake (postData) {
    var options = {
        host: 'api.payapp.kr',
        path: '/oapi/apiLoad.html',
        port: '80',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return options;
}

/**
 * 응답
 * @param response
 */
function readJSONResponse(response) {
    var responseData = '';
    response.on('data', function (chunk) {
        responseData += chunk;
    });
    response.on('end', function () {
        var result = querystring.parse(responseData);
        //state = 1 이면 성공
        //state = 0 이면 실패
        console.log("result==" + JSON.stringify(result));
    });
}


module.exports = router;
