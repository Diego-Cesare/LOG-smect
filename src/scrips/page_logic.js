const titleType = document.getElementById("title-type");
const legendItem = document.getElementById("legend-item");
const itemTime = document.getElementById("item-time");
const itemDate = document.getElementById("item-date");
const reportForm = document.getElementById("report-form");
const shareReportButton = document.getElementById("share-report");

const toggleTheme = () => {
  const html = document.documentElement;

  const current = html.getAttribute("data-theme");

  if (current === "dark") {
    html.setAttribute("data-theme", "light");
  } else {
    html.setAttribute("data-theme", "dark");
  }
};

const itensLegends = {
  receiving: {
    title: "Recebimento de Materiais",
    legend: "Item Recebido",
    timeItem: "Hora de recebimento",
    dateItem: "Data de recebimento",
  },
  delivery: {
    title: "Entrega de Materiais",
    legend: "Item Entregue",
    timeItem: "Hora da entrega",
    dateItem: "Data da entrega",
  },
};

const params = new URLSearchParams(window.location.search);
const type = params.get("type");

if (type && itensLegends[type] && titleType && legendItem && itemTime && itemDate) {
  titleType.textContent = itensLegends[type].title;
  legendItem.textContent = itensLegends[type].legend;
  itemTime.textContent = itensLegends[type].timeItem;
  itemDate.textContent = itensLegends[type].dateItem;

  if (type === "receiving") {
    toggleTheme();
  }
}

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${dateValue}T00:00:00`),
  );
};

const createReport = (formData) => {
  const jsPDF = window.jspdf?.jsPDF;

  if (!jsPDF) {
    alert("Biblioteca de PDF indisponível no momento.");
    return null;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = itensLegends[type]?.title || "Registro de Materiais";
  const now = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  let y = 20;

  const addText = (text, options = {}) => {
    const lines = doc.splitTextToSize(text, 180);
    const lineHeight = 6;
    const projectedHeight = lines.length * lineHeight;

    if (y + projectedHeight > 285) {
      doc.addPage();
      y = 20;
    }

    doc.text(lines, 15, y, options);
    y += projectedHeight;
  };

  const addSection = (sectionTitle, rows) => {
    doc.setFont("helvetica", "bold");
    addText(sectionTitle);
    y += 1;

    doc.setFont("helvetica", "normal");
    rows.forEach(([label, value]) => {
      addText(`${label}: ${value || "-"}`);
    });

    y += 4;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  addText(title);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  addText(`Gerado em: ${now}`);
  y += 4;

  addSection("Item", [
    ["Tipo de item", formData.itemType],
    ["Quantidade", formData.itemQuantity],
    ["Descrição", formData.itemDescription],
  ]);

  addSection("Recebedor", [
    ["Local", formData.receiverLocation],
    ["Nome", formData.receiverName],
  ]);

  addSection("Entrega", [
    ["Nome do entregador", formData.delivererName],
    ["Hora", formData.eventTime],
    ["Data", formatDate(formData.eventDate)],
  ]);

  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  const filePrefix = type === "delivery" ? "registro-entrega" : "registro-recebimento";
  const fileName = `${filePrefix}-${suffix}.pdf`;
  const shareText = [
    `${title}`,
    `Item: ${formData.itemType || "-"}`,
    `Quantidade: ${formData.itemQuantity || "-"}`,
    `Local: ${formData.receiverLocation || "-"}`,
    `Recebedor: ${formData.receiverName || "-"}`,
    `Entregador: ${formData.delivererName || "-"}`,
    `Data/Hora: ${formatDate(formData.eventDate)} ${formData.eventTime || ""}`.trim(),
  ].join("\n");

  return { doc, title, fileName, shareText };
};

const getFormData = () => Object.fromEntries(new FormData(reportForm).entries());

const downloadPdf = (formData) => {
  const report = createReport(formData);

  if (!report) {
    return;
  }

  report.doc.save(report.fileName);
};

const fallbackShare = async ({ title, shareText }) => {
  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(shareText);
  const whatsappUrl = `https://wa.me/?text=${encodedBody}`;
  const emailUrl = `mailto:?subject=${encodedTitle}&body=${encodedBody}`;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch (error) {
      console.warn("Falha ao copiar texto para area de transferencia.", error);
    }
  }

  const openWhatsapp = window.confirm(
    "Compartilhamento nativo indisponivel. OK para WhatsApp, Cancelar para e-mail.",
  );

  if (openWhatsapp) {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = emailUrl;
  }
};

const shareReport = async (formData) => {
  const report = createReport(formData);

  if (!report) {
    return;
  }

  const { doc, fileName, title, shareText } = report;

  if (navigator.share) {
    try {
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({ title, text: shareText, files: [pdfFile] });
      } else {
        await navigator.share({ title, text: shareText });
      }

      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  await fallbackShare({ title, shareText });
};

if (reportForm) {
  reportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    downloadPdf(getFormData());
  });
}

if (reportForm && shareReportButton) {
  shareReportButton.addEventListener("click", async () => {
    await shareReport(getFormData());
  });
}
