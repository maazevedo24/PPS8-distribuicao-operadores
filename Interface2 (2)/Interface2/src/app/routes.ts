import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Resultados from "./pages/Resultados";
import FichaTecnica from "./pages/FichaTecnica";
import Configuracao from "./pages/Configuracao";
import Historico from "./pages/Historico";

export const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { path: "/", Component: Home },
      { path: "/ficha-tecnica", Component: FichaTecnica },
      { path: "/configuracao", Component: Configuracao },
      { path: "/historico", Component: Historico },
      { path: "/resultados", Component: Resultados },
    ],
  },
]);