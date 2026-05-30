var express = require('express');
var router = express.Router();

// 연동매뉴얼의 "feedbackurl 전달" 참고
//feedback을 받는 부분
router.post('/', function(req, res, next) {
  console.log(req.body);

  res.send('SUCCESS');
  //res.send('FAIL');
});

module.exports = router;
