package com.udid.oapi.lib;


import org.json.JSONObject;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

public class PAStrLib
{

	public static String convertEncodeQueryString(Map<String, String> params)
	{
		StringBuilder result = new StringBuilder();
		boolean first = true;

		for (HashMap.Entry<String, String> pair : params.entrySet())
		{
			if (null != pair.getValue()) {

				if (first)
					first = false;
				else
					result.append("&");

				try {
					result.append(URLEncoder.encode(pair.getKey(), "UTF-8"));
					result.append("=");
					result.append(URLEncoder.encode(pair.getValue(), "UTF-8"));
				} catch (UnsupportedEncodingException e) {
					e.printStackTrace();
				}
			}

		}

		return result.toString();
	}

	public static String queryStringToJsonString(String query) {
		Map<String,String> map = new HashMap<>();
		try {

			String myStringDecoded  = URLDecoder.decode(query, "UTF-8");
			String[] parts = myStringDecoded.split("&");

			for(String part: parts){
				String[] keyVal = part.split("=");

				String val = keyVal.length > 1 ? keyVal[1] : "";
				map.put(keyVal[0], val);
			}
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}

		JSONObject json =  new JSONObject(map);
		return json.toString();
	}

}


