package kr.co.udid.payapp.sample.module.Imp;

import kr.co.udid.payapp.sample.module.ApiInitialization;
import kr.co.udid.payapp.sample.module.data.*;
import kr.co.udid.payapp.sample.module.data.Result.CommonResult;
import kr.co.udid.payapp.sample.module.data.Result.PayappAccountResult;
import kr.co.udid.payapp.sample.module.data.Result.PayappCashStResult;
import kr.co.udid.payapp.sample.module.sv.PayappSv;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLDecoder;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 패이앱 결재 Sv
 * 
 * @author RED
 * 
 */
@Service
public class PayappSvImp implements PayappSv
{


	@Autowired
	ApiInitialization apiInitialization;


	/**
	 * 결제 요청
	 *
	 * @param payappID : 페이앱 아이디
	 * @param accountData : 결제 정보
	 * @return
	 * @throws IOException
	 */
	@Override
	public PayappAccountResult requestAccount (String payappID, PayappAccountData accountData) throws IOException
	{

		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();
		
		urlParameters.add (new BasicNameValuePair ("cmd", "payrequest"));
		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("goodname", accountData.getGoodname ()));
		urlParameters.add (new BasicNameValuePair ("price", String.valueOf (accountData.getPrice ())));
		urlParameters.add (new BasicNameValuePair ("recvphone", accountData.getRecvphone ()));
		urlParameters.add (new BasicNameValuePair ("memo", accountData.getMemo ()));
		
		// 피드백 URL
		if (!isEmptyStr (accountData.getFeedBackUrl  ()))
			urlParameters.add (new BasicNameValuePair ("feedbackurl", accountData.getFeedBackUrl ()));
		
		// 임의 변수 1
		if (!isEmptyStr (accountData.getVal1  ()))
			urlParameters.add (new BasicNameValuePair ("var1", accountData.getVal1 ()));
		
		// 임의 변수 2
		if (!isEmptyStr (accountData.getVal2  ()))
			urlParameters.add (new BasicNameValuePair ("var2", accountData.getVal2 ()));
		
		// SMS 발송 여부
		if (!accountData.isSendSms ())
			urlParameters.add (new BasicNameValuePair ("smsuse", "n"));

		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();
		
		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");
		String mulNo = mapData.get("mul_no");
		String payUrl = mapData.get("payurl");
		String errNo = mapData.get("errno");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");
		String mulNo = mapData.get("mulNo");
		String payUrl = mapData.get("payUrl");
		String errNo = mapData.get("errNo");*/


		// 결과를 생성한다.
		return new PayappAccountResult (state.equals ("1"), errorMessage, payUrl, mulNo, errNo);
	}


	/**
	 * 결제 취소요청
	 * @param payappID				: 페이앱 아이디
	 * @param accountCancelData		: 취소 정보
	 * @return
	 * @throws IOException
	 */
	@Override
	public CommonResult requestAccountCancel(String payappID, PayappAccountCancelData accountCancelData) throws IOException {

		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "paycancel"));


		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("linkkey", accountCancelData.getLinkkey()));
		urlParameters.add (new BasicNameValuePair ("mul_no", accountCancelData.getMul_no()));
		urlParameters.add (new BasicNameValuePair ("cancelmode", accountCancelData.getCancelmode()));
		urlParameters.add (new BasicNameValuePair ("cancelmemo", accountCancelData.getCancelmemo()));

		// 부분 취소 부분 아래 parameter 값을 추가해서 전달한다.
		// partcancel 결제요청취소 구분 (0:전취소, 1:부분취소)
		// cancelprice 결제요청취소 금액 (부분취소인 경우 필수)
		//urlParameters.add (new BasicNameValuePair ("partcancel", "1");
		//urlParameters.add (new BasicNameValuePair ("cancelprice", "1000");


		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");*/


		// 결과를 생성한다.
		return new CommonResult (state.equals ("1"), errorMessage);
	}

	/**
	 * 페이앱 결제 취소 요청
	 * @param payappID					: 페이앱 아이디
	 * @param accountCancelReqData		: 취소요청 데이타
	 * @return
	 * @throws IOException
	 */
	@Override
	public CommonResult requestAccountCancel(String payappID, PayappAccountCancelReqData accountCancelReqData) throws IOException {
		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "paycancel"));
		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("linkkey", accountCancelReqData.getLinkkey()));
		urlParameters.add (new BasicNameValuePair ("mul_no", accountCancelReqData.getMul_no()));
		urlParameters.add (new BasicNameValuePair ("cancelmemo", accountCancelReqData.getCancelmemo()));

		// 부분 취소 부분 아래 parameter 값을 추가해서 전달한다.
		// partcancel 결제요청취소 구분 (0:전취소, 1:부분취소)
		// cancelprice 결제요청취소 금액 (부분취소인 경우 필수)
		//urlParameters.add (new BasicNameValuePair ("partcancel", "1");
		//urlParameters.add (new BasicNameValuePair ("cancelprice", "1000");


		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");*/


		// 결과를 생성한다.
		return new CommonResult (state.equals ("1"), errorMessage);

	}

	/**
	 * 정기 결제 요청
	 * @param payappID
	 * @param accountData
	 * @return
	 */
	@Override
	public PayappAccountResult requestRegularAccount(String payappID, PayappAccountData accountData) throws IOException {

		List<NameValuePair> urlParameters = new ArrayList<> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "rebillRegist"));
		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("goodname", accountData.getGoodname ()));
		urlParameters.add (new BasicNameValuePair ("goodprice", String.valueOf (accountData.getPrice ())));
		urlParameters.add (new BasicNameValuePair ("recvphone", accountData.getRecvphone ()));
		urlParameters.add (new BasicNameValuePair ("memo", accountData.getMemo ()));

		//정기결제 특수 필드
		urlParameters.add (new BasicNameValuePair ("rebillCycleType", accountData.getRebillCycleType ()));
		urlParameters.add (new BasicNameValuePair ("rebillCycleMonth", accountData.getRebillCycleMonth ()));
		urlParameters.add (new BasicNameValuePair ("rebillExpire", accountData.getRebillExpire ()));

		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute (post);
		}
		catch (ClientProtocolException ignored)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.getOrDefault ("state", "");
		String errorMessage = URLDecoder.decode (mapData.getOrDefault ("errorMessage", ""), "UTF-8");
		String rebillNo = mapData.getOrDefault ("rebill_no", "");
		String payUrl = URLDecoder.decode (mapData.getOrDefault ("payurl", ""), "UTF-8");
		String errNo = mapData.getOrDefault ("errno", "");


		/*
		1.8 샘플
		Map<String, String> resMap = parseList.stream ().collect (Collectors.toMap (NameValuePair::getName, NameValuePair::getValue));

		String state = resMap.getOrDefault ("state", "");;
		String errorMessage = URLDecoder.decode (resMap.getOrDefault ("errorMessage", ""), "UTF-8");
		String rebillNo = resMap.getOrDefault ("rebill_no", "");
		String payUrl = URLDecoder.decode (resMap.getOrDefault ("payurl", ""), "UTF-8");
		String errNo = resMap.getOrDefault ("errno", "");*/


		// 결과를 생성한다.
		return new PayappAccountResult (state.equals ("1"), errorMessage, "Y", payUrl, rebillNo, errNo);
	}

	/**
	 * 정기 결제 취소 요청
	 * @param userid
	 * @param data
	 * @return
	 * @throws IOException
	 */
	@Override
	public CommonResult requestAccountRegularCancel(String userid, PayappAccountCancelReqData data)throws IOException {
		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "rebillCancel"));
		urlParameters.add (new BasicNameValuePair ("userid", userid));
		urlParameters.add (new BasicNameValuePair ("linkkey", data.getLinkkey()));
		urlParameters.add (new BasicNameValuePair ("rebill_no", data.getRebill_no()));
		urlParameters.add (new BasicNameValuePair ("cancelmemo", data.getCancelmemo()));


		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");*/


		// 결과를 생성한다.
		return new CommonResult (state.equals ("1"), errorMessage);
	}


	/**
	 * 부계정 등록
	 * @param payappID                	: 페이앱 아이디
	 * @param subidRegistData        	: 부계정 등록 정보
	 * @return
	 * @throws IOException
	 */
	@Override
	public CommonResult subidRegist(String payappID, PayappSubidRegistData subidRegistData) throws IOException {
		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

			urlParameters.add (new BasicNameValuePair ("cmd", "subidregist"));


			urlParameters.add (new BasicNameValuePair ("userid", payappID));
			urlParameters.add (new BasicNameValuePair ("subuserid", subidRegistData.getSubuserid()));
			urlParameters.add (new BasicNameValuePair ("subpwd", subidRegistData.getSubpwd()));
			urlParameters.add (new BasicNameValuePair ("subname", subidRegistData.getSubname()));

		System.out.println("subidRegistData :: "+subidRegistData.toString());


		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");*/


		// 결과를 생성한다.
		return new CommonResult (state.equals ("1"), errorMessage);
	}


	/**
	 * 현금영수증 발행
	 * @param payappID			: 페이앱 아이디
	 * @param cashStData		: 현금영수증 발행 정보
	 * @return
	 * @throws IOException
	 */
	@Override
		public PayappCashStResult PayappCashSt(String payappID, PayappCashStData cashStData) throws IOException {

		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "cashSt"));
		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("good_name", cashStData.getGood_name()));
		urlParameters.add (new BasicNameValuePair ("buyr_name", cashStData.getBuyr_name()));

		if (cashStData.getBuyr_tel1() != null)
			urlParameters.add (new BasicNameValuePair ("buyr_tel1", cashStData.getBuyr_tel1()));


		if (cashStData.getBuyr_mail() != null)
			urlParameters.add (new BasicNameValuePair ("buyr_mail", cashStData.getBuyr_mail()));

		urlParameters.add (new BasicNameValuePair ("id_info", cashStData.getId_info()));
		urlParameters.add (new BasicNameValuePair ("trad_time", cashStData.getTrad_time()));
		urlParameters.add (new BasicNameValuePair ("tr_code", cashStData.getTr_code()));
		urlParameters.add (new BasicNameValuePair ("amt_tot", cashStData.getAmt_tot()));
		urlParameters.add (new BasicNameValuePair ("amt_sup", cashStData.getAmt_sup()));
		urlParameters.add (new BasicNameValuePair ("amt_svc", cashStData.getAmt_svc()));
		urlParameters.add (new BasicNameValuePair ("amt_tax", cashStData.getAmt_tax()));
		urlParameters.add (new BasicNameValuePair ("corp_tax_type", cashStData.getCorp_tax_type()));


		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");
		String cashstno = mapData.get("cashstno");
		String cashsturl = mapData.get("cashsturl");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		String cashstno = mapData.get("cashstno");
		String cashsturl = mapData.get("cashsturl");*/

		// 결과를 생성한다.
		return new PayappCashStResult (state.equals ("1"), errorMessage, cashstno, cashsturl);

	}

	/**
	 * 현금 영수증 발행 취소
	 * @param payappID                : 페이앱 아이디
	 * @param cashStCnData            : 현금영수증 발행 취소 정보
	 * @return
	 * @throws IOException
	 */
	@Override
	public CommonResult PayappCashStCn(String payappID, PayappCashStCnData cashStCnData) throws IOException {


		List<NameValuePair> urlParameters = new ArrayList<NameValuePair> ();

		urlParameters.add (new BasicNameValuePair ("cmd", "cashStCn"));


		urlParameters.add (new BasicNameValuePair ("userid", payappID));
		urlParameters.add (new BasicNameValuePair ("cashstno", cashStCnData.getCashstno()));

		HttpPost post = apiInitialization.getHttpPost(urlParameters);

		HttpClient client = HttpClientBuilder.create().build ();

		HttpResponse response = null;

		try
		{
			response = client.execute(post);
		}
		catch (ClientProtocolException e)
		{
		}

		BufferedReader rd = new BufferedReader (new InputStreamReader (response.getEntity ().getContent ()));

		// 결과를 받아온다.
		String line = rd.readLine ();

		rd.close ();

		List<NameValuePair> parseList = URLEncodedUtils.parse(line, Charset.forName("UTF-8"));

		Map<String, String> mapData = new HashMap<String,String>();
		for (int i=0; i< parseList.size(); i++)
		{
			mapData.put(parseList.get(i).getName(),parseList.get(i).getValue());
		}

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");

		/*
		1.8 샘플
		Map<String, String> mapData = parseList.stream().collect(Collectors.toMap(NameValuePair::getName, NameValuePair::getValue));

		String state = mapData.get("state");
		String errorMessage = mapData.get("errorMessage");*/


		// 결과를 생성한다.
		return new CommonResult (state.equals ("1"), errorMessage);

	}

	/**
	 * 문자열 null 체크  null 이거나 빈공백이면 true 리턴 
	 * @param str
	 * @return
	 */
	private static boolean isEmptyStr (String str)
	{
		if (str == null)
			return true;
		
		if (str.equals (""))
			return true;
		
		return false;
	}
}
