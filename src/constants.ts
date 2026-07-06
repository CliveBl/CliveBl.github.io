import { configurationData } from "./index.js";

// Debug flag
const DEBUG = true;

export function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.log(...args);
  }
}

const elementTitles = {
  registeredTaxpayerBoolean: "בדרך כלל זהו בן הזוג בעל השכר הגבוה ביותר. ניתן לבדוק ולשנות זאת בעת בקשה להגיש דו״ח לרשות המסים.",
  paragraph44or45Options: "סעיף 44 הוא לניכוי הוצאות ששולמו למוסד עבור קרוב נטול יכולת. סעיף 45 הוא לנקודת זיכוי מס.",
  totalInstitutionExpenses: "רלוונטי רק לסעיף 44.",
  numberOfInstitutionReceiptsInteger: "רלוונטי רק לסעיף 44.",
  lockedToClientIdBoolean:
    "בדרך כלל אנחנו משייכים תרומות לבן זוג הרשום כדי לקבל את ההחזיר המקסמלי. יש מקרים בודדים שיותר טוב לשייך אותם לבת זוג או לחלק בן הזוג. אפשר לעשות את זה על ידי בחירה את הסימון הזה.",
  currencySelect: "שמור שינוים כדי לראות את השינוי",
  purchasePriceFXX: "מחיר הרכישה במטבע המקורי של העסקה, בתוספת עמלות",
  salePriceFXX: "מחיר המכירה במטבע המקורי של העסקה, פחות עמלות",
  propertyName: "שם המניה או נכס אחר",
  SettlementDiscount_327_287: " בטופס 106 השדה יכול להופיע כ193/093 בצורה מפורטת. כאן יש את הצורה מקודדת שמס הכנסה משתמש. מימים אחוז הנחה, קוד תקרה, מספר חודשי תושבות בשנת המס."
};

export const DEFAULT_CLIENT_ID_NUMBER = "000000000";

export function getElementTitle(key: string) {
  const title = elementTitles[key as keyof typeof elementTitles];
  return title;
}

export function isCurrencyField(fieldName: string) {
  return !(
    fieldName.endsWith("Name") ||
    fieldName.endsWith("Text") ||
    fieldName.endsWith("Number") ||
    fieldName.endsWith("taxYear") ||
    fieldName.endsWith("Date") ||
    fieldName.endsWith("Months") ||
    fieldName.endsWith("Integer") ||
    fieldName.endsWith("Code") ||
    fieldName.endsWith("Boolean") ||
    fieldName.endsWith("Options") ||
    fieldName.endsWith("Select") ||
    fieldName.endsWith("Type")
  );
}

// Some fields are integers but do not end with "Integer". We want to treat them as integers and not apply currency formatting to them.
const exceptionalIntegerFieldNames = ["SettlementDiscount_327_287"];
export function isExceptionalIntegerField(fieldName: string) {
  return exceptionalIntegerFieldNames.includes(fieldName);
}

export function isFieldValidForTaxYear(fieldName: string, taxYear: number) {
  if (fieldName === "TemporarySalaryReductionRecuperationFund_012_011" && taxYear < 2024) {
    return false;
  }
  return true;
}

const urlParams = new URLSearchParams(window.location.search);
const hideIdentity = urlParams.get("hideIdentity") === "true";

export function dummyName(name: string) {
  if (hideIdentity) {
    if (name.includes("שרה")) {
      return "שרה בן דוד";
    }
    return "משה בן דוד";
  }
  return name;
}

export function dummyIdNumber(idNumber: string) {
  if (hideIdentity) {
    if (idNumber === "DEFAULT_CLIENT_ID_NUMBER") {
      return "DEFAULT_CLIENT_ID_NUMBER";
    }
    if (idNumber.includes("05239")) {
      return "123456789";
    }
    return "223344556";
  }
  return idNumber;
}

export const NO_YEAR = "ללא שנה";

export const ANONYMOUS_EMAIL = "AnonymousEmail";

export function is106TypeForm(fileData: any) {
  return fileData.documentType === "טופס 106 מעביד" || fileData.documentType === "אישור מס עבור קרן פנסיה חדשה" || fileData.type === "FormNewPensionFund";
}

// Map of error codes to FAQ section IDs
export const errorCodeToFaqId: Record<string, string> = {
  "^NoIdentity": "faq-personal-details",
  "^LossesTransferred": "faq-calculations",
  "^TotalChildren": "faq-common-mistakes",
  "^TaxCalc": "faq-calculation-failure",
  "^NoSimulator": "faq-calculation-failure",
};

// Map of error codes to Help section IDs
export const errorCodeToHelpId: Record<string, string> = {
  "^No106": "form106",
  "^NoSalary": "form106",
  "^DonationReceiptUnknownId": "donations",
  "^SettlementDiscount_327_287": "residency",
  "^SettlementStart": "residency",
  "^Rent10TotalBelowDoubleExemption": "rental-income",
  "^Rent10TotalBelowExemption": "rental-income",
  "^Rent10NonJointFilingForPreMarriageOrInheritance": "rental-income",
  "^NumberOfInstitutionReceiptsMismatch": "disabled-dependant-116a",
  "^TotalInstitutionExpensesMismatch": "disabled-dependant-116a",
};
