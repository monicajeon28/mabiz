package kr.co.udid.payapp.sample.module.data;

/**
 * Simple 패이앱 결제 데이터
 * @author RED
 *
 */
public class PayappAccountData
{
	/**
	 * 상품명
	 */
	private String goodname;
	
	/**
	 * 상품 금액
	 */
	private int price;
	
	/**
	 * 수신 핸드폰
	 */
	private String recvphone;
	
	/**
	 * 메모
	 */
	private String memo;
	
	/**
	 * 피드백 URL
	 */
	private String feedBackUrl;
	
	/**
	 * 추가 값1
	 */
	private String val1;
	
	/**
	 * 추가 값2
	 */
	private String val2;
	
	/**
	 * SMS 발송 여부
	 */
	private boolean sendSms;

	/**
	 * 정기 결제 타입 ( Month,Week,Day )
	 */
	private String rebillCycleType;

	/**
	 * 월 정기결제 결제일 (1~31,90:말일)
	 */
	private String rebillCycleMonth;

	/**
	 * 정기결제 만료일 (yyyy-mm-dd)
	 */
	private String rebillExpire;

	public PayappAccountData (String goodname, int price, String recvphone)
	{
		super ();
		this.goodname = goodname;
		this.price = price;
		this.recvphone = recvphone;
		
		this.sendSms = true;
	}

	public PayappAccountData (String goodname, int price, String recvphone,String rebillCycleMonth, String rebillExpire,String rebillCycleType)
	{
		super ();
		this.goodname = goodname;
		this.price = price;
		this.recvphone = recvphone;
		this.rebillCycleMonth = rebillCycleMonth;
		this.rebillCycleType = rebillCycleType;
		this.rebillExpire = rebillExpire;

		this.sendSms = true;
	}

	public String getGoodname ()
	{
		return goodname;
	}

	public void setGoodname (String goodname)
	{
		this.goodname = goodname;
	}

	public int getPrice ()
	{
		return price;
	}

	public void setPrice (int price)
	{
		this.price = price;
	}

	public String getRecvphone ()
	{
		return recvphone;
	}

	public void setRecvphone (String recvphone)
	{
		this.recvphone = recvphone;
	}

	public String getMemo ()
	{
		return memo;
	}

	public void setMemo (String memo)
	{
		this.memo = memo;
	}

	public String getFeedBackUrl ()
	{
		return feedBackUrl;
	}

	public void setFeedBackUrl (String feedBackUrl)
	{
		this.feedBackUrl = feedBackUrl;
	}

	public String getVal1 ()
	{
		return val1;
	}

	public void setVal1 (String val1)
	{
		this.val1 = val1;
	}

	public String getVal2 ()
	{
		return val2;
	}

	public void setVal2 (String val2)
	{
		this.val2 = val2;
	}

	public boolean isSendSms ()
	{
		return sendSms;
	}

	public void setSendSms (boolean sendSms)
	{
		this.sendSms = sendSms;
	}

	public String getRebillCycleType() {
		return rebillCycleType;
	}

	public void setRebillCycleType(String rebillCycleType) {
		this.rebillCycleType = rebillCycleType;
	}

	public String getRebillCycleMonth() {
		return rebillCycleMonth;
	}

	public void setRebillCycleMonth(String rebillCycleMonth) {
		this.rebillCycleMonth = rebillCycleMonth;
	}

	public String getRebillExpire() {
		return rebillExpire;
	}

	public void setRebillExpire(String rebillExpire) {
		this.rebillExpire = rebillExpire;
	}

	@Override
	public String toString() {
		return "PayappAccountData{" +
				"goodname='" + goodname + '\'' +
				", price=" + price +
				", recvphone='" + recvphone + '\'' +
				", memo='" + memo + '\'' +
				", feedBackUrl='" + feedBackUrl + '\'' +
				", val1='" + val1 + '\'' +
				", val2='" + val2 + '\'' +
				", sendSms=" + sendSms +
				", rebillCycleType='" + rebillCycleType + '\'' +
				", rebillCycleMonth='" + rebillCycleMonth + '\'' +
				", rebillExpire='" + rebillExpire + '\'' +
				'}';
	}
}
