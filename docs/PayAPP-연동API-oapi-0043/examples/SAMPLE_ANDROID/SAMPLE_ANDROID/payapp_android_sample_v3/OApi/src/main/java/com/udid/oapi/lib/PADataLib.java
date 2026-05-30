package com.udid.oapi.lib;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Create by 김진원
 */
public class PADataLib {

    public static String getCurrentDateTime ()
    {
        SimpleDateFormat tFormatter = new SimpleDateFormat ("yyyyMMddHHmmss");
        String currentDate = tFormatter.format (new Date());
        return (currentDate);
    }
}
