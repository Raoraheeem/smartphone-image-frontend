import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './App.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { CSVLink } from 'react-csv';

function App() {
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState('');
  const [brand, setBrand] = useState('iPhone');
  const [images, setImages] = useState([]);
  const [analysis, setAnalysis] = useState({});
  const [brandSharpness, setBrandSharpness] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const chartRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) return alert('Please select an image');

    const formData = new FormData();
    formData.append('image', image);
    formData.append('brand', brand);

    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      setMessage(res.data.message);
      setImage(null);
      fetchImages();
    } catch (err) {
      console.error(err);
      setMessage('Upload failed');
    }
  };

  const fetchImages = async () => {
    try {
      const res = await axios.get('http://localhost:5000/images');
      setImages(res.data);
    } catch (err) {
      console.error('Failed to fetch images', err);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const analyzeImage = async (img) => {
    try {
      const filenameWithoutPrefix = img.filename.replace(/^processed-/, '');
      const res = await axios.get(`http://localhost:5000/analyze/processed/${filenameWithoutPrefix}`);
      setAnalysis((prev) => ({
        ...prev,
        [img.filename]: res.data.metrics,
      }));
    } catch (err) {
      console.error('Analysis failed:', err);
      alert('Analysis failed.');
    }
  };

  const analyzeAllImages = async () => {
    const brandGroups = {};

    for (let img of images) {
      const filename = img.filename;
      const filenameWithoutPrefix = filename.replace(/^processed-/, '');

      try {
        const res = await axios.get(`http://localhost:5000/analyze/processed/${filenameWithoutPrefix}`);
        const variance = parseFloat(res.data.metrics.variance);
        const mean = parseFloat(res.data.metrics.mean);
        const contrastEstimate = parseFloat(res.data.metrics.contrastEstimate);

        if (!brandGroups[img.brand]) {
          brandGroups[img.brand] = [];
        }

        brandGroups[img.brand].push({ variance, mean, contrastEstimate });
      } catch (err) {
        console.error(`Error analyzing ${filename}:`, err.message);
      }
    }

    const result = Object.entries(brandGroups).map(([brand, stats]) => {
      const avgSharpness = stats.reduce((sum, v) => sum + v.variance, 0) / stats.length;
      const avgBrightness = stats.reduce((sum, v) => sum + v.mean, 0) / stats.length;
      const avgContrast = stats.reduce((sum, v) => sum + v.contrastEstimate, 0) / stats.length;

      return {
        brand,
        averageSharpness: parseFloat(avgSharpness.toFixed(2)),
        averageBrightness: parseFloat(avgBrightness.toFixed(2)),
        averageContrast: parseFloat(avgContrast.toFixed(2)),
      };
    }).sort((a, b) => b.averageSharpness - a.averageSharpness);

    setBrandSharpness(result);
  };

  const downloadChartAsPNG = () => {
    if (chartRef.current === null) return;
    toPng(chartRef.current)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'Comparison-chart.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Error downloading PNG:', err);
      });
  };

  const downloadChartAsPDF = () => {
    if (chartRef.current === null) return;
    toPng(chartRef.current)
      .then((dataUrl) => {
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Comparison-chart.pdf');
      })
      .catch((err) => {
        console.error('Error downloading PDF:', err);
      });
  };

  const filteredImages = selectedBrand === 'All' ? images : images.filter(img => img.brand === selectedBrand);

  return (
    <div className="container">
      <h1>📱 Smartphone Image Processor</h1>

      <form onSubmit={handleSubmit} className="form">
        <input type="file" onChange={(e) => setImage(e.target.files[0])} />
        <select onChange={(e) => setBrand(e.target.value)} value={brand}>
          <option value="iPhone">iPhone</option>
          <option value="Samsung">Samsung</option>
          <option value="Pixel">Pixel</option>
          <option value="Xiaomi">Xiaomi</option>
        </select>
        <button type="submit" className="btn blue">Upload & Process</button>
        {message && <p className="message success">{message}</p>}
      </form>

      <div className="controls">
        <button onClick={analyzeAllImages} className="btn green">📊 Compare by Brand</button>
        {brandSharpness.length > 0 && (
          <CSVLink data={brandSharpness} filename="sharpness-report.csv" >
            <button id='csv'> 📥 Export CSV</button>
           
          </CSVLink>
        )}
        <select id='brand-filter' value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
          <option value="All">All Brands</option>
          <option value="iPhone">iPhone</option>
          <option value="Samsung">Samsung</option>
          <option value="Pixel">Pixel</option>
          <option value="Xiaomi">Xiaomi</option>
        </select>
      </div>

      {brandSharpness.length > 0 && (
        <div className="chart-wrapper" ref={chartRef}>
          <h2>📊 Average Metrics by Brand</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={brandSharpness} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="brand" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="averageSharpness" fill="#2563EB" name="Sharpness" />
              <Bar dataKey="averageBrightness" fill="#F59E0B" name="Brightness" />
              <Bar dataKey="averageContrast" fill="#10B981" name="Contrast" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex-wrap">
            <button onClick={downloadChartAsPNG} id='png'>⬇️ Download as PNG</button>
            <button onClick={downloadChartAsPDF} id='pdf'>📄 Download as PDF</button>
          </div>
        </div>
      )}

      <h2>🖼 Uploaded Images</h2>
      <div className="image-gallery">
        {filteredImages.map((img) => (
          <div key={img._id} className="image-card">
            <h3>{img.brand}</h3>
            <p>{new Date(img.processedAt).toLocaleString()}</p>
            <div className="flex-wrap">
              <div>
                <p>Original</p>
                <img src={`http://localhost:5000/uploads/${img.originalName}`} alt="original" />
              </div>
              <div>
                <p>Processed</p>
                <img src={`http://localhost:5000/uploads/${img.filename}`} alt="processed" />
              </div>
            </div>
            <button onClick={() => analyzeImage(img)} className="btn blue">Analyze</button>
            {analysis[img.filename] && (
              <div className="metric-display">
                <p>📈 <strong>Sharpness:</strong> {analysis[img.filename].variance}</p>
                <p>🌗 <strong>Brightness:</strong> {analysis[img.filename].mean}</p>
                <p>🌓 <strong>Contrast:</strong> {analysis[img.filename].contrastEstimate}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
