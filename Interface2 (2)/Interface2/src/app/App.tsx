import { RouterProvider } from "react-router";
import { router } from "./routes";
import { StorageProvider } from "./contexts/StorageContext";

export default function App() {
  return (
    <StorageProvider>
      <RouterProvider router={router} />
    </StorageProvider>
  );
}
