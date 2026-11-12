import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const DEFAULT_META = {
  expenseCategories: ["Housing", "Groceries", "Transport", "Eating out", "Bills & utilities", "Health", "Education", "Shopping", "Entertainment", "Travel", "Gifts & donations", "Other"],
  incomeCategories: ["Salary", "Freelance", "Scholarship", "Business", "Gifts", "Refunds", "Other income"],
  paymentMethods: ["Cash", "Card", "Bank transfer", "Mobile wallet"],
  currencies: ["TND", "USD", "EUR", "GBP", "INR", "MAD"],
};

const MetaContext = createContext(DEFAULT_META);

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(DEFAULT_META);
  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
