import axios from "axios";

export const uploadMedia = async (file) => {

  const formData = new FormData();

  formData.append("file", file);

  const response = await axios.post(
    `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/upload`,
    formData,

    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};