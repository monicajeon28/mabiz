package kr.co.udid.payapp.sample;

import kr.co.udid.payapp.sample.module.data.*;
import kr.co.udid.payapp.sample.module.data.Result.CommonResult;
import kr.co.udid.payapp.sample.module.data.Result.PayappAccountResult;
import kr.co.udid.payapp.sample.module.data.Result.PayappCashStResult;
import kr.co.udid.payapp.sample.module.sv.PayappSv;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.ModelAndView;

import java.io.IOException;

/**
 * Created by kimjinwon on 2016. 11. 10..
 */
@Controller
public class SampleController
{
	/**
	 * 페이앱 서비스
	 */
	@Autowired
	PayappSv payappSv;

	/**
	 * 결제 요청
	 *
	 * @param userid 			: 판매자 회원 아이디
	 * @param goodname 			: 상품명
	 * @param price 			: 상품가격
	 * @param recvphone			: 연락처
	 * @param memo				: 메모
	 * @return
	 */
	@RequestMapping(value="/paymentReqAction")
	public ModelAndView paymentReqAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value="userid", defaultValue="") String userid

			/**
			 * 상품명
			 */
			, @RequestParam(value="goodname", defaultValue="") String goodname

			/**
			 * 상품가격
			 */
			, @RequestParam(value="price", defaultValue="0") Integer price

			/**
			 * 연락처
			 */
			, @RequestParam(value="recvphone", defaultValue="") String recvphone

			/**
			 * 메모
			 */
			, @RequestParam(value="memo", defaultValue="") String memo
	)
	{
		ModelAndView mv = new ModelAndView ("paymentReq");

		// 페이앱 아이디를 입력해주세요
		final String payappID = userid;

		// 결제 요청 데이터
		// 필수 : 상품명, 상품 가격, 상대방 전화번호
		PayappAccountData accountData = new PayappAccountData (goodname, price.intValue (), recvphone);

		// 피드백 URL
		accountData.setFeedBackUrl ("");

		// SMS 발송 여부
		accountData.setSendSms (true);

		// 메모 설정
		accountData.setMemo (memo);

		// 에러 메시지
		String errorMsg = "";

		try
		{
			// 결제를 요청한다.
			PayappAccountResult result = payappSv.requestAccount (payappID, accountData);

			System.out.println("result :: "+result.toString());
			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}
		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;
	}

	/**
	 * 결제 (요청, 승인) 취소
	 * @param userid			: 판매자 회원 아이디
	 * @param linkkey			: 연동 KEY
	 * @param mul_no			: 결제요청본호
	 * @return
	 */

	@RequestMapping(value = "/paymentReqCancelAction")
	public ModelAndView paymentReqCancelAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 연동 KEY
			 */
			, @RequestParam(value = "linkkey", defaultValue = "") String linkkey

			/**
			 * 결제요청번호
			 */
			, @RequestParam(value = "mul_no", defaultValue = "") String mul_no

			/**
			 * 결제요청취소 모드
			 */
			, @RequestParam(value = "cancelmode", defaultValue = "") String cancelmode

			/**
			 * 메모
			 */
			, @RequestParam(value="memo", defaultValue="") String memo
	){

		ModelAndView mv = new ModelAndView ("paymentReqCancel");

		PayappAccountCancelData data = new PayappAccountCancelData(linkkey, mul_no, memo);

		//값이 ready 인 경우 결제요청 상태만 취소 가능)
		if (cancelmode.equals("Y")){
			data.setCancelmode("ready");
		} else {
			data.setCancelmode("");
		}


		// 에러 메시지
		String errorMsg = "";
		try {
			CommonResult result = payappSv.requestAccountCancel(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}


		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;

	}


	/**
	 * 결제 취소 요청
	 * @param userid		: 판매자 회원 아이디
	 * @param linkkey		: 연동 KEY
	 * @param mul_no		: 결제요청본호
	 * @param memo			: 메모
	 * @return
	 */
	@RequestMapping(value = "/paymentCancelReqAction")
	public ModelAndView paymentCancelReqAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 연동 KEY
			 */
			, @RequestParam(value = "linkkey", defaultValue = "") String linkkey

			/**
			 * 결제요청번호
			 */
			, @RequestParam(value = "mul_no", defaultValue = "") String mul_no

			/**
			 * 메모
			 */
			, @RequestParam(value="memo", defaultValue="") String memo
	){

		ModelAndView mv = new ModelAndView ("paymentCancelReq");

		PayappAccountCancelReqData data = new PayappAccountCancelReqData(linkkey, mul_no, memo);

		// 에러 메시지
		String errorMsg = "";
		try {
			CommonResult result = payappSv.requestAccountCancel(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}

		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;

	}


	/**
	 * 정기 결제 요청
	 *
	 * @param userid 			: 판매자 회원 아이디
	 * @param goodname 			: 상품명
	 * @param price 			: 상품가격
	 * @param recvphone			: 연락처
	 * @param memo				: 메모
	 * @return
	 */
	@RequestMapping(value="/paymentRegularAction")
	public ModelAndView paymentRegularAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value="userid", defaultValue="") String userid

			/**
			 * 상품명
			 */
			, @RequestParam(value="goodname", defaultValue="") String goodname

			/**
			 * 상품가격
			 */
			, @RequestParam(value="price", defaultValue="0") Integer price

			/**
			 * 연락처
			 */
			, @RequestParam(value="recvphone", defaultValue="") String recvphone

			/**
			 * 메모
			 */
			, @RequestParam(value="memo", defaultValue="") String memo

			/**
			 * 정기 결제 일
			 */
			, @RequestParam(value="rebillCycleMonth", defaultValue="") String rebillCycleMonth

			/**
			 * 정기 결제 만료일
			 */
			, @RequestParam(value="rebillExpire", defaultValue="") String rebillExpire

			/**
			 * 정기 결제 타입 ( Month,Week,Day )
			 */
			, @RequestParam(value="rebillCycleType", defaultValue="") String rebillCycleType
	)
	{
		ModelAndView mv = new ModelAndView ("paymentCancelRegularReq");

		// 페이앱 아이디를 입력해주세요
		final String payappID = userid;

		// 결제 요청 데이터
		// 필수 : 상품명, 상품 가격, 상대방 전화번호
		PayappAccountData accountData = new PayappAccountData (goodname, price.intValue (), recvphone,rebillCycleMonth,rebillExpire,rebillCycleType);

		// 피드백 URL
		accountData.setFeedBackUrl ("");

		// SMS 발송 여부
		accountData.setSendSms (true);

		// 메모 설정
		accountData.setMemo (memo);

		// 에러 메시지
		String errorMsg = "";

		try
		{
			// 결제를 요청한다.
			PayappAccountResult result = payappSv.requestRegularAccount (payappID, accountData);

			System.out.println("result :: "+result.toString());
			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}
		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;
	}


	/**
	 * 정기 결제 취소 요청
	 * @param userid		: 판매자 회원 아이디
	 * @param linkkey		: 연동 KEY
	 * @param rebill_no		: 정기결제요청본호
	 * @param memo			: 메모
	 * @return
	 */
	@RequestMapping(value = "/paymentCancelRegularAction")
	public ModelAndView paymentCancelRegularAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 연동 KEY
			 */
			, @RequestParam(value = "linkkey", defaultValue = "") String linkkey

			/**
			 * 결제요청번호
			 */
			, @RequestParam(value = "rebill_no", defaultValue = "") String rebill_no

			/**
			 * 메모
			 */
			, @RequestParam(value="memo", defaultValue="") String memo
	){

		ModelAndView mv = new ModelAndView ("paymentCancelRegularReq");

		PayappAccountCancelReqData data = new PayappAccountCancelReqData(linkkey, rebill_no, memo,"rebill_no");

		// 에러 메시지
		String errorMsg = "";
		try {
			CommonResult result = payappSv.requestAccountRegularCancel(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}

		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;

	}


	/**
	 *	부계정 등록
	 * @param userid			: 판매자 회원 아이디
	 * @param subuserid			: 부계정 아이디
	 * @param subpwd			: 부계정 비밀번호
	 * @param subname			: 부계정명
	 * @return
	 */
	@RequestMapping(value = "/subidRegistAction")
	public ModelAndView subidRegistAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 부계정 아이디
			 */
			, @RequestParam(value = "subuserid", defaultValue = "") String subuserid

			/**
			 * 부계정 비밀번호
			 */
			, @RequestParam(value = "subpwd", defaultValue = "") String subpwd

			/**
			 * 부계정 명
			 */
			, @RequestParam(value="subname", defaultValue="") String subname
	){

		ModelAndView mv = new ModelAndView ("subidRegist");


		System.out.println("subname :: "+subname);

		PayappSubidRegistData data = new PayappSubidRegistData(subuserid, subpwd, subname);

		// 에러 메시지
		String errorMsg = "";
		try {
			CommonResult result = payappSv.subidRegist(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}

		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;

	}


	/**
	 * 현금영수증 발행
	 * @param userid 			: 판매자 회원 아이디
	 * @param good_name			: 상품명
	 * @param buyr_name			: 구매자 명
	 * @param id_info			: 휴대폰 번호 또는 사업자 번호
	 * @param trad_time			: 원거래시간
	 * @param tr_code			: 발해용도(0:소득공제용 1:지출증빙용)
	 * @param amt_tot			: 거래금액
	 * @param amt_sup			: 공급가액
	 * @param amt_svc			: 봉사료
	 * @param amt_tax			: 부가가치세
	 * @param corp_tax_type		: 과세:TG01, 면세:TG02
	 * @return
	 */
	@RequestMapping(value = "/cashStAction")
	public ModelAndView cashStAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 상품명
			 */
			, @RequestParam(value = "good_name", defaultValue = "") String good_name

			/**
			 * 구매자명
			 */
			, @RequestParam(value = "buyr_name", defaultValue = "") String buyr_name

			/**
			 * 휴대폰번호 또는 사업자번호
			 */
			, @RequestParam(value="id_info", defaultValue="") String id_info

			/**
			 * 원거래시각
			 */
			, @RequestParam(value="trad_time", defaultValue="") String trad_time

			/**
			 * 발행용도(0:소득공제용, 1:지출증빙용)
			 */
			, @RequestParam(value="tr_code", defaultValue="") String tr_code

			/**
			 * 거래금액
			 */
			, @RequestParam(value="amt_tot", defaultValue="") String amt_tot

			/**
			 * 공급가액
			 */
			, @RequestParam(value="amt_sup", defaultValue="") String amt_sup

			/**
			 * 봉사료
			 */
			, @RequestParam(value="amt_svc", defaultValue="") String amt_svc

			/**
			 * 부가가치세
			 */
			, @RequestParam(value="amt_tax", defaultValue="") String amt_tax

			/**
			 * 과세:TG01, 면세:TG02
			 */
			, @RequestParam(value="corp_tax_type", defaultValue="") String corp_tax_type

	){

		ModelAndView mv = new ModelAndView ("cashSt");

		String trCode = "";
		if (tr_code.equals("on")){
			trCode = "0";
		} else {
			trCode = "1";
		}

		String corpTaxType = "";
		if (corp_tax_type.equals("on")){
			corpTaxType = "TG01";
		} else {
			corpTaxType = "TG02";
		}

		PayappCashStData data = new PayappCashStData(good_name, buyr_name, id_info, trad_time, trCode, amt_tot, amt_sup, amt_svc, amt_tax, corpTaxType);

		System.out.println("data :: "+data);

		// 에러 메시지
		String errorMsg = "";
		try {
			PayappCashStResult result = payappSv.PayappCashSt(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}

		}
		catch (IOException e) {
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;
	}


	/**
	 * 현금영수증 발행 취소
	 * @param userid			: 판매자 회원 아이디
	 * @param cashstno			: 발행번호
	 * @return
	 */
	@RequestMapping(value = "/cashStCnAction")
	public ModelAndView cashStCnAction (

			/**
			 * 판매자 회원 아이디
			 */
			@RequestParam(value = "userid", defaultValue = "") String userid

			/**
			 * 부계정 아이디
			 */
			, @RequestParam(value = "cashstno", defaultValue = "") String cashstno

	){

		ModelAndView mv = new ModelAndView ("cashStCn");

		PayappCashStCnData data = new PayappCashStCnData(cashstno);

		// 에러 메시지
		String errorMsg = "";
		try {
			CommonResult result = payappSv.PayappCashStCn(userid, data);

			// 결제 성공 여부 판단.
			if (result.isSuccess ())
			{
				mv.addObject ("result", result);
			}
			else
			{
				errorMsg = result.getErrorMessage ();
			}

		}
		catch (IOException e)
		{
			errorMsg = "통신중 에러가 발생하였습니다.";
		}

		mv.addObject ("errorMsg", errorMsg);

		return mv;

	}


















}
