import React, { useState, useEffect } from 'react';
import { Upload, Download, RefreshCw, Settings, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// API Base URL - using direct URL since process.env isn't available in artifacts
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AutomatedAssayAnalysis = () => {
  const [file, setFile] = useState(null);
  const [labelsFile, setLabelsFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [config, setConfig] = useState({
    normalization: 'zscore',
    pca_components: 2,
    variance_threshold: 0.01
  });
  const [activeTab, setActiveTab] = useState('upload');

  // Check API health on mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) {
        setApiStatus('connected');
        setError(null);
      } else {
        setApiStatus('error');
        setError('API is not responding properly');
      }
    } catch (err) {
      setApiStatus('error');
      setError('Cannot connect to backend API. Make sure it is running on port 5000.');
    }
  };

  const handleFileUpload = (event, type = 'data') => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && uploadedFile.name.endsWith('.csv')) {
      if (type === 'data') {
        setFile(uploadedFile);
      } else {
        setLabelsFile(uploadedFile);
      }
      setError(null);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleAnalysis = async () => {
    if (!file) {
      setError('Please upload a data file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Upload files
      const formData = new FormData();
      formData.append('data_file', file);
      if (labelsFile) {
        formData.append('labels_file', labelsFile);
      }

      const uploadResponse = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload successful:', uploadResult);

      // Step 2: Run analysis
      const analysisResponse = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const analysisResult = await analysisResponse.json();
      console.log('Analysis complete:', analysisResult);
      console.log('PCA data:', analysisResult.results?.pca_data);
      console.log('Data length:', analysisResult.results?.pca_data?.length);
      console.log('Sample point:', analysisResult.results?.pca_data?.[0]);

      setAnalysisData(analysisResult.results);
      setActiveTab('results');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }



  };


  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pca_results_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export results');
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl">
          <p className="text-white font-bold text-lg mb-2">{data.id}</p>
          <div className="space-y-1 text-sm">
            <p className={`font-semibold ${data.type === 'ALL' ? 'text-blue-400' : 'text-red-400'}`}>
              Type: {data.type}
            </p>
            <p className="text-gray-300">PC1: {data.pc1?.toFixed(2)}</p>
            <p className="text-gray-300">PC2: {data.pc2?.toFixed(2)}</p>
            <p className="text-gray-300">Genes Expressed: {data.genes_expressed}</p>
            <p className="text-gray-300">Mean Expression: {data.mean_expression?.toFixed(2)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Automated Assay Analysis</h1>
                <p className="text-sm text-gray-400">Gene Expression Data Visualization Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {apiStatus === 'connected' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-green-400">API Connected</span>
                  </>
                ) : apiStatus === 'checking' ? (
                  <>
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                    <span className="text-sm text-yellow-400">Checking...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400">API Offline</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'upload'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'config'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Configure
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  disabled={!analysisData}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'results'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                  }`}
                >
                  Results
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="text-red-200 font-semibold">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Data Ingestion
              </h2>
              <p className="text-gray-400 mb-6">
                Upload your gene expression CSV file (7,129 genes × 38 samples)
              </p>
              
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'data')}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-2">
                    {file ? file.name : 'Click to upload data file'}
                  </p>
                  <p className="text-sm text-gray-400">Gene expression data (CSV)</p>
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'labels')}
                  className="hidden"
                  id="labels-upload"
                />
                <label htmlFor="labels-upload" className="cursor-pointer">
                  <p className="text-white font-semibold mb-2">
                    {labelsFile ? labelsFile.name : 'Upload labels file (optional)'}
                  </p>
                  <p className="text-sm text-gray-400">ALL/AML classification labels</p>
                </label>
              </div>

              {file && (
                <div className="mt-6 bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Download className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{file.name}</p>
                        <p className="text-sm text-gray-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                          {labelsFile && ` + ${labelsFile.name}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleAnalysis}
                      disabled={loading || apiStatus !== 'connected'}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Run Analysis'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-3">Analysis Pipeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-blue-400 font-bold mb-2">1. Normalization</div>
                  <p className="text-sm text-gray-400">Z-score normalization across 7,129 gene features</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-blue-400 font-bold mb-2">2. PCA</div>
                  <p className="text-sm text-gray-400">Dimensionality reduction to 2D principal components</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-blue-400 font-bold mb-2">3. Visualization</div>
                  <p className="text-sm text-gray-400">Interactive scatter plot with ALL/AML clustering</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Analysis Configuration
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-2">
                  Normalization Method
                </label>
                <select
                  value={config.normalization}
                  onChange={(e) => setConfig({...config, normalization: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="zscore">Z-Score Normalization</option>
                  <option value="log2">Log2 Transformation</option>
                  <option value="quantile">Quantile Normalization</option>
                  <option value="robust">Robust Scaling</option>
                </select>
                <p className="text-sm text-gray-400 mt-2">
                  Standardizes gene expression values across samples
                </p>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">
                  PCA Components: {config.pca_components}
                </label>
                <input
                  type="range"
                  min="2"
                  max="3"
                  value={config.pca_components}
                  onChange={(e) => setConfig({...config, pca_components: parseInt(e.target.value)})}
                  className="w-full"
                />
                <p className="text-sm text-gray-400 mt-2">
                  Number of principal components to compute
                </p>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">
                  Variance Threshold: {config.variance_threshold}
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={config.variance_threshold}
                  onChange={(e) => setConfig({...config, variance_threshold: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <p className="text-sm text-gray-400 mt-2">
                  Minimum variance threshold for feature selection
                </p>
              </div>

              <button
                onClick={() => setActiveTab('upload')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && analysisData && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Genes</p>
                <p className="text-2xl font-bold text-white">{analysisData.stats.total_genes}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Samples</p>
                <p className="text-2xl font-bold text-white">{analysisData.stats.total_samples}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">PC1 Variance</p>
                <p className="text-2xl font-bold text-blue-400">{analysisData.stats.variance_explained[0]}%</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">PC2 Variance</p>
                <p className="text-2xl font-bold text-blue-400">{analysisData.stats.variance_explained[1]}%</p>
              </div>
            </div>

            {/* PCA Scatter Plot */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  PCA Analysis: ALL vs AML Gene Expression
                </h2>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              <p className="text-gray-400 mb-6">
                Interactive scatter plot showing principal component analysis results. 
                Hover over points for detailed patient information.
              </p>
              
              <ResponsiveContainer width="100%" height={500}>
                {/* Results Tab - find the ScatterChart section and replace the Scatter components */}
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number" 
                    dataKey="pc1" 
                    name="PC1" 
                    stroke="#9CA3AF"
                    label={{ value: `PC1 (${analysisData.stats.variance_explained[0]}% variance)`, position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="pc2" 
                    name="PC2" 
                    stroke="#9CA3AF"
                    label={{ value: `PC2 (${analysisData.stats.variance_explained[1]}% variance)`, angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {/* Show labeled ALL samples if they exist */}
                  {analysisData.pca_data.filter(d => d.type === 'ALL').length > 0 && (
                    <Scatter 
                      name="ALL (Acute Lymphoblastic Leukemia)" 
                      data={analysisData.pca_data.filter(d => d.type === 'ALL')} 
                      fill="#3B82F6"
                    />
                  )}
                  
                  {/* Show labeled AML samples if they exist */}
                  {analysisData.pca_data.filter(d => d.type === 'AML').length > 0 && (
                    <Scatter 
                      name="AML (Acute Myeloid Leukemia)" 
                      data={analysisData.pca_data.filter(d => d.type === 'AML')} 
                      fill="#EF4444"
                    />
                  )}
                  
                  {/* Show unlabeled samples in gray */}
                  {analysisData.pca_data.filter(d => !d.type).length > 0 && (
                    <Scatter 
                      name="Unlabeled Samples" 
                      data={analysisData.pca_data.filter(d => !d.type)} 
                      fill="#9CA3AF"
                    />
                  )}
                </ScatterChart> 
              </ResponsiveContainer>
            </div>

            {/* Analysis Summary */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Analysis Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-semibold mb-2">Sample Distribution</h4>
                  <div className="space-y-2">
                    {analysisData.metadata.all_count !== undefined && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">ALL Samples:</span>
                          <span className="text-blue-400 font-bold">{analysisData.metadata.all_count}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">AML Samples:</span>
                          <span className="text-red-400 font-bold">{analysisData.metadata.aml_count}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Processing Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Normalization:</span>
                      <span className="text-white font-mono text-sm">{analysisData.stats.normalization_method}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Processing Time:</span>
                      <span className="text-green-400 font-bold">{analysisData.stats.processing_time}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomatedAssayAnalysis;
