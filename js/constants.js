const friendlyNames = {
    field867Type: "סוג שדה 867",
    field106Type: "סוג שדה 106",
    fields: "שדות",
    genericFields: "שדות נוספות",
    clientName: "שם הלקוח",
    familyName: "שם משפחה",
    documentType: "סוג מסמך",
    organizationName: "שם הארגון",
    explanationText: "הסבר",
    value: "סכום",
    valueInteger: "קוד",
    receiptInteger: "מספר קבלה",
    donationDate: "תאריך תרומה",
    nonProfitTaxFileNumber: "קוד עמותה/ארגון",
    employerTaxFileNumber: "מספר מעסיק",
    branchCode: "קוד סניף",
    accountNumber: "מספר חשבון",
    matchTag: "תג התאמה",
    reason: "סיבה",
    cityName: "שם העיר",
    startDate: "תאריך התחלה",
    endDate: "תאריך סיום",
    NumberOfDealsInteger: "כמות עיסקאות",
    releaseDate: "תאריך שחרור",
    numberOfServiceMonths: "חודשי שרות",
    NONE: "בוחר",
    monthsOfEmploymentInteger: "חודשי עבודה",
    ReceivedFromNI_196_194: "התקבל מהמוסד לביטוח לאומי",
    Salary_172_158: "שכר עבודה",
    LeavingBonus_272_258: "מענק פרישה",
    TaxFreeLeavingBonus_209: "מענק פרישה פטור ממס",
    EducationFund_219_218: "השכר לקרן השתלמות",
    EmployerKupatGemel_249_248: "קופת גמל מעסיק",
    InsuredIncome_245_244: "הכנסה מבוטחת",
    IncomeTaxDeduction_042: "מס הכנסה",
    NationalInsuranceIncomeTaxDeduction_040: "מס הכנסה מקצבה ביטוח לאומי",
    Donations_237_037: "תרומות",
    NationalInsuranceNotIncludingHealthTaxDeduction: "ביטוח לאומי ללא ניכוי מס בריאות",
    TemporarySalaryReductionRecuperationFund_012_011: "השתתפות זמנית הפחתת דמי הבראה",
    TaxFreeSalary_309_109: "שכר פטור ממס לאנשים עם מגבלות של 100%",
    PersonalDeductionFundMember_086_045: "ניכוי אישי חבר קרן",
    SettlementDiscount_327_287: "הנחה ישוב",
    ShiftAllowance_069_068: "תוספת משמרות",
    SoldiersSalary_198_197: "שכר חייל",
    DepositToNewPensionFund_180_135: "הפקדה לקרן פנסיה חדשה",
    DepositCurrentAccountIncomeTaxedAtPercent10_076: "הכנסה מחשבון עובר ושב ממוסה ב-10%",
    DepositCurrentAccountIncomeTaxedAtPercent15_078: "הכנסה מחשבון עובר ושב ממוסה ב-15%",
    DepositIncomeTaxedAtPercent10_076: "ריבית על פיקדונות ממוסה ב-10%",
    DepositIncomeTaxedAtPercent15_078: "ריבית על פיקדונות ממוסה ב-15%",
    DepositIncomeTaxedAtPercent20_126: "ריבית על פיקדונות ממוסה ב-20%",
    DepositIncomeTaxedAtPercent25_142: "ריבית על פיקדונות ממוסה ב-25%",
    DepositIncomeTaxedAtPercent23_232: "ריבית על פיקדונות ממוסה ב-23%",
    DepositIncomeTaxedAtPercent35_053: "ריבית על פיקדונות ממוסה ב-35%",
    DepositFXIncomeTaxedAtPercent15_078: 'ריבית על פיקדונות מט"ח ממוסה ב-15%',
    DepositFXIncomeTaxedAtPercent20_126: 'ריבית על פיקדונות מט"ח ממוסה ב-20%',
    DepositFXIncomeTaxedAtPercent25_142: 'ריבית על פיקדונות מט"ח ממוסה ב-25%',
    DepositFXIncomeTaxedAtPercent23_232: 'ריבית על פיקדונות מט"ח ממוסה ב-23%',
    DepositFXIncomeTaxedAtPercent35_053: 'ריבית על פיקדונות מט"ח ממוסה ב-35%',
    ProfitIncomeTaxedAtPercent0: "רווח הון ממוסה ב-0%",
    ProfitIncomeTaxedAtPercent15: "רווח הון ממוסה ב-15%",
    ProfitIncomeTaxedAtPercent20: "רווח הון ממוסה ב-20%",
    ProfitIncomeTaxedAtPercent25: "רווח הון ממוסה ב-25%",
    ProfitIncomeTaxedAtPercent23: "רווח הון ממוסה ב-23%",
    ProfitIncomeTaxedAtPercent30: "רווח הון ממוסה ב-30%",
    ProfitIncomeTaxedAtPercent35: "רווח הון ממוסה ב-35%",
    OffsetableLosses: "הפסדים ניתנים לקיזוז",
    TotalSales_256: 'סה"כ מכירות',
    TaxDeductedAtSourceProfit_040: "מס שנוכה במקור מרווח הון",
    DividendFXIncomeTaxedAtPercent0: 'דיבידנד מט"ח ממוסה ב-0%',
    DividendFXIncomeTaxedAtPercent4: 'דיבידנד מט"ח ממוסה ב-4%',
    DividendFXIncomeTaxedAtPercent15: 'דיבידנד מט"ח ממוסה ב-15%',
    DividendFXIncomeTaxedAtPercent20: 'דיבידנד מט"ח ממוסה ב-20%',
    DividendFXIncomeTaxedAtPercent25: 'דיבידנד מט"ח ממוסה ב-25%',
    DividendFXIncomeTaxedAtPercent23: 'דיבידנד מט"ח ממוסה ב-23%',
    DividendIncomeTaxedAtPercent0: "דיבידנד ממוסה ב-0%",
    DividendIncomeTaxedAtPercent4: "דיבידנד ממוסה ב-4%",
    DividendIncomeTaxedAtPercent15: "דיבידנד ממוסה ב-15%",
    DividendIncomeTaxedAtPercent20: "דיבידנד ממוסה ב-20%",
    DividendIncomeTaxedAtPercent25: "דיבידנד ממוסה ב-25%",
    DividendIncomeTaxedAtPercent23: "דיבידנד ממוסה ב-23%",
    InterestIncomeTaxedAtPercent0: "ריבית מניירות ערך ממוסה ב-0%",
    InterestIncomeTaxedAtPercent10: "ריבית מניירות ערך ממוסה ב-10%",
    InterestIncomeTaxedAtPercent15: "ריבית מנייות ערך ממוסה ב-15%",
    InterestIncomeTaxedAtPercent20: "ריבית מניירות ערך ממוסה ב-20%",
    InterestIncomeTaxedAtPercent25: "ריבית מניירות ערך ממוסה ב-25%",
    InterestIncomeTaxedAtPercent23: "ריבית מניירות ערך ממוסה ב-23%",
    InterestIncomeTaxedAtPercent35: "ריבית מניירות ערך ממוסה ב-35%",
    TaxDeductedAtSourceDeposit_043: "מס שנוכה במקור (פקדון)",
    TaxDeductedAtSourceDividend_040: "מס שנוכה במקור (דיבידנד)",
    TaxDeductedAtSourceInterest_040: "מס שנוכה במקור (ריבית)",
    TotalExemptInterestAndIndexLinkageDifference_209: "ריבית פטורה והפרש הצמדה",
    LossesTransferredFromPreviousYear: "הפסדים שהועברו משנה קודמת",
    registeredTaxpayerBoolean: "בן/בת זוג רשום",
    birthDate: "תאריך לידה",
    children: "ילדים",
    noSecondParentBoolean: "אין הורה שני",
    caringForBoolean: "הילד בהחזקתי",
    requestDelayOfPointsBoolean: "בקשה לדחיי נקודות",
    requestUsePointsFromLastYearBoolean: "בקשה להשתמש בנקודות משנה קודמת",
    newImmigrantArrivalDate: "תאריך עליה",
    returningResidentReturnDate: "תאריך חזרה, תושב חוזר",
    degreeCompletionDate: "תאריך סיום לימודי תואר ראשון",
    specializationCompletionDate: "תאריך סיום לימודי תואר שני",
    degreeCode: "קוד תואר ראשון",
    noteText: "הערה",
    taxYear: "שנה",
    clientIdentificationNumber: "מספר זיהוי",
    fileName: "שם הקובץ",
    reasonText: "סיבה",
    movedHereDuringYearBoolean: "עברתי לכאן במהלך השנה",
    maritalStatusOptions: {
        name: "מצב משפחתי",
        options: ["רווק", "נשוי", "אלמן", "גרוש", "פרוד"],
    },
    genderOptions: { name: "מין", options: ["זכר", "נקבה"] },
    blindOrDisabledBoolean: "עיוור או נכה לפי סעיף 9(5)(א) או (א1) לפקודה",
    blindOrDisabledAndReceivingBenefitsBoolean: "עיוור או נכה לפי סעיף 9(5)(א) או (א1) לפקודה ומקבל גמלה ממשרד הבטחון/פעולות איבה"
};
export function getFriendlyName(key) {
    const friendly = friendlyNames[key];
    if (friendly === undefined) {
        console.error(`Friendly name for ${key} not found`);
    }
    return typeof friendly === "string" ? friendly : friendly?.name ?? "";
}
export function getFriendlyOptions(key) {
    const friendly = friendlyNames[key];
    return typeof friendly === "object" && "options" in friendly ? friendly.options : [];
}
export function getFriendlyOptionName(key) {
    const friendly = friendlyNames[key];
    const name = typeof friendly === "object" && "name" in friendly ? friendly.name : "";
    return name;
}
export function isCurrencyField(fieldName) {
    return !(fieldName.endsWith("Name") ||
        fieldName.endsWith("Text") ||
        fieldName.endsWith("Number") ||
        fieldName.endsWith("taxYear") ||
        fieldName.endsWith("Date") ||
        fieldName.endsWith("Months") ||
        fieldName.endsWith("Integer") ||
        fieldName.endsWith("Code") ||
        fieldName.endsWith("Boolean") ||
        fieldName.endsWith("Options") ||
        fieldName.endsWith("Type"));
}
const exceptionalIntegerFieldNames = [
    "SettlementDiscount_327_287",
    "NumberOfDealsInteger"
];
export function isExceptionalIntegerField(fieldName) {
    return exceptionalIntegerFieldNames.includes(fieldName);
}
export function isFieldValidForTaxYear(fieldName, taxYear) {
    if (fieldName === "TemporarySalaryReductionRecuperationFund_012_011" && taxYear < 2024) {
        return false;
    }
    return true;
}
const urlParams = new URLSearchParams(window.location.search);
const hideIdentity = urlParams.get("hideIdentity") === "true";
export function dummyName(name) {
    if (hideIdentity) {
        if (name.includes("שרה")) {
            return "שרה בן דוד";
        }
        return "משה בן דוד";
    }
    return name;
}
export function dummyIdNumber(idNumber) {
    if (hideIdentity) {
        if (idNumber === "000000000") {
            return "000000000";
        }
        if (idNumber.includes("05239")) {
            return "123456789";
        }
        return "223344556";
    }
    return idNumber;
}
export const NO_YEAR = "ללא שנה";
//# sourceMappingURL=constants.js.map