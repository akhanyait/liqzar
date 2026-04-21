import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BackButton = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-primary-foreground/15 transition-colors text-primary-foreground">
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
};

export default BackButton;
