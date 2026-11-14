document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("foodImageInput");
  const previewImg = document.getElementById("foodPreviewImg");
  if (fileInput && previewImg) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      previewImg.src = URL.createObjectURL(file);
      previewImg.classList.remove("d-none");
    });
  }
});
