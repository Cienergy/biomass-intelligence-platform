import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataProvider } from "./lib/DataContext";
import { Layout } from "./components/Layout";
import { ExplorerPage } from "./pages/ExplorerPage";
import { ComparePage } from "./pages/ComparePage";
import { ReportPage } from "./pages/ReportPage";
import "./styles/app.css";

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ExplorerPage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}
