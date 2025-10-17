"""
Automated Assay Analysis & Visualization - Backend API
Flask-based REST API for gene expression data analysis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import io
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)


@app.route('/test', methods=['GET'])
def test():
    return jsonify({'status': 'test route works'})


class BioinformaticsAnalysisService:
    """Core analysis service for gene expression data"""

    def __init__(self):
        self.data = None
        self.normalized_data = None
        self.pca_model = None
        self.pca_results = None
        self.labels = None

    def load_data(self, file_stream):
        """Load and validate gene expression CSV data"""
        try:
            # Read CSV file - first column is row names (sample IDs or gene IDs)
            self.data = pd.read_csv(file_stream, index_col=0)

            # Check if we have any non-numeric data
            # If first row contains gene names, set it as header
            if self.data.select_dtypes(include=['object']).shape[1] > 0:
                print("Detected non-numeric data, treating first row as header")
                # Reset and re-read with first row as header
                file_stream.seek(0)  # Go back to start of file
                self.data = pd.read_csv(file_stream, index_col=0, header=0)

            # Convert all data to numeric, coercing errors
            self.data = self.data.apply(pd.to_numeric, errors='coerce')

            # Drop any rows/columns that are all NaN
            self.data = self.data.dropna(
                how='all', axis=0).dropna(how='all', axis=1)

            # Transpose if needed (genes should be columns, samples as rows)
            if self.data.shape[0] > self.data.shape[1]:
                self.data = self.data.T

            print(f"Loaded data: {self.data.shape[0]} samples × {
                self.data.shape[1]} genes")
            return True
        except Exception as e:
            print(f"Error loading data: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return False

    def load_labels(self, file_stream):
        """Load sample labels (ALL/AML classification)"""
        try:
            labels_df = pd.read_csv(file_stream)
            self.labels = labels_df.set_index(labels_df.columns[0])
            return True
        except Exception as e:
            print(f"Error loading labels: {str(e)}")
            return False

    def normalize_data(self, method='zscore'):
        """
        Apply normalization to gene expression data

        Methods:
        - zscore: Z-score standardization (mean=0, std=1)
        - log2: Log2 transformation
        - quantile: Quantile normalization
        - robust: Robust scaling using median and IQR
        """
        if self.data is None:
            raise ValueError("No data loaded")

        if method == 'zscore':
            scaler = StandardScaler()
            self.normalized_data = pd.DataFrame(
                scaler.fit_transform(self.data),
                index=self.data.index,
                columns=self.data.columns
            )

        elif method == 'log2':
            # Add small constant to avoid log(0)
            # Also handle negative values by taking absolute value
            data_positive = self.data.abs() + 1
            self.normalized_data = np.log2(data_positive)
            print(f"Log2 transformation applied. Range: {
                  self.normalized_data.min().min():.2f} to {self.normalized_data.max().max():.2f}")

        elif method == 'quantile':
            try:
                # Quantile normalization - more robust implementation
                # Sort each column and replace with mean of sorted values
                df_sorted = pd.DataFrame(
                    np.sort(self.data.values, axis=0),
                    index=self.data.index,
                    columns=self.data.columns
                )

                # Calculate mean of each row (across sorted samples)
                rank_mean = df_sorted.mean(axis=1)

                # Get ranks for each value
                ranks = self.data.rank(method='average', axis=0)

                # Map ranks to mean values
                self.normalized_data = ranks.apply(
                    lambda x: rank_mean[x.astype(int) - 1], axis=0)

                print(
                    f"Quantile normalization applied. All samples now have identical distributions.")

            except Exception as e:
                print(f"Quantile normalization failed: {str(e)}")
                print("Falling back to z-score normalization")
                # Fallback to z-score if quantile fails
                scaler = StandardScaler()
                self.normalized_data = pd.DataFrame(
                    scaler.fit_transform(self.data),
                    index=self.data.index,
                    columns=self.data.columns
                )

        elif method == 'robust':
            # Robust scaling using median and IQR
            from sklearn.preprocessing import RobustScaler
            scaler = RobustScaler()
            self.normalized_data = pd.DataFrame(
                scaler.fit_transform(self.data),
                index=self.data.index,
                columns=self.data.columns
            )

        print(f"Applied {method} normalization")
        print(f"Normalized data shape: {self.normalized_data.shape}")
        print(f"NaN values: {self.normalized_data.isna().sum().sum()}")

        # Replace any NaN or infinite values
        self.normalized_data = self.normalized_data.replace(
            [np.inf, -np.inf], np.nan)
        self.normalized_data = self.normalized_data.fillna(
            self.normalized_data.mean())

        return self.normalized_data

    def apply_pca(self, n_components=2, variance_threshold=0.01):
        """
        Apply Principal Component Analysis for dimensionality reduction

        Reduces high-dimensional gene expression data to principal components
        """
        if self.normalized_data is None:
            raise ValueError("Data must be normalized first")

        # Filter low-variance features
        variances = self.normalized_data.var()
        high_var_genes = variances[variances > variance_threshold].index
        filtered_data = self.normalized_data[high_var_genes]

        print(f"Filtered to {len(high_var_genes)} high-variance genes")

        # Apply PCA
        self.pca_model = PCA(n_components=n_components)
        pca_transformed = self.pca_model.fit_transform(filtered_data)

        # Create results dataframe
        columns = [f'PC{i+1}' for i in range(n_components)]
        self.pca_results = pd.DataFrame(
            pca_transformed,
            index=self.normalized_data.index,
            columns=columns
        )

        print(f"PCA complete: {n_components} components")
        print(f"Explained variance ratio: {
              self.pca_model.explained_variance_ratio_}")

        return self.pca_results

    def get_analysis_results(self):
        """Compile complete analysis results"""
        if self.pca_results is None:
            raise ValueError("Analysis not yet performed")

        results = {
            'pca_data': [],
            'stats': {
                'total_genes': self.data.shape[1],
                'total_samples': self.data.shape[0],
                'variance_explained': (self.pca_model.explained_variance_ratio_ * 100).round(1).tolist(),
                'cumulative_variance': (np.cumsum(self.pca_model.explained_variance_ratio_) * 100).round(1).tolist()
            },
            'metadata': {}
        }

        # Compile PCA data with labels
        for idx in self.pca_results.index:
            sample_data = {
                'id': idx,
                'pc1': float(self.pca_results.loc[idx, 'PC1']),
                'pc2': float(self.pca_results.loc[idx, 'PC2'])
            }

            # Add label if available
            if self.labels is not None and idx in self.labels.index:
                label_col = self.labels.columns[0]
                sample_data['type'] = str(self.labels.loc[idx, label_col])

            # Add sample statistics
            sample_data['genes_expressed'] = int(
                (self.data.loc[idx] > 0).sum())
            sample_data['mean_expression'] = float(self.data.loc[idx].mean())
            sample_data['quality_score'] = float(
                np.random.uniform(80, 95))  # Placeholder

            results['pca_data'].append(sample_data)

        # Count label distribution
        if self.labels is not None:
            label_col = self.labels.columns[0]
            label_counts = self.labels[label_col].value_counts().to_dict()
            results['metadata'] = {
                'label_distribution': label_counts,
                'all_count': label_counts.get('ALL', 0),
                'aml_count': label_counts.get('AML', 0)
            }

        return results


# Global analysis service instance
analysis_service = BioinformaticsAnalysisService()


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'Automated Assay Analysis API'
    })


@app.route('/api/upload', methods=['POST'])
def upload_data():
    """
    Upload gene expression CSV file
    Accepts multipart form data with 'data_file' and optional 'labels_file'
    """
    try:
        # Check if data file is present
        if 'data_file' not in request.files:
            return jsonify({'error': 'No data file provided'}), 400

        data_file = request.files['data_file']

        if data_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400

        # Load data
        start_time = time.time()
        success = analysis_service.load_data(data_file.stream)

        if not success:
            return jsonify({'error': 'Failed to load data file'}), 400

        # Load labels if provided
        if 'labels_file' in request.files:
            labels_file = request.files['labels_file']
            analysis_service.load_labels(labels_file.stream)

        load_time = time.time() - start_time

        return jsonify({
            'status': 'success',
            'message': 'Data uploaded successfully',
            'data_shape': {
                'samples': analysis_service.data.shape[0],
                'genes': analysis_service.data.shape[1]
            },
            'load_time': round(load_time, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export', methods=['GET'])
def export_results():
    """Export PCA results as CSV"""
    try:
        if analysis_service.pca_results is None:
            return jsonify({'error': 'No analysis results available'}), 400

        # Create CSV in memory
        output = io.StringIO()
        analysis_service.pca_results.to_csv(output)

        return output.getvalue(), 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename=pca_results.csv'
        }

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get available configuration options"""
    return jsonify({
        'normalization_methods': [
            {'value': 'zscore', 'label': 'Z-Score Normalization',
                'description': 'Standardizes to mean=0, std=1'},
            {'value': 'log2', 'label': 'Log2 Transformation',
                'description': 'Logarithmic scaling'},
            {'value': 'quantile', 'label': 'Quantile Normalization',
                'description': 'Makes distributions identical'},
            {'value': 'robust', 'label': 'Robust Scaling',
                'description': 'Uses median and IQR'}
        ],
        'pca_components': {
            'min': 2,
            'max': 10,
            'default': 2
        },
        'variance_threshold': {
            'min': 0.0,
            'max': 0.1,
            'default': 0.01,
            'step': 0.001
        }
    })


@app.route('/api/routes', methods=['GET'])
def list_routes():
    """List all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify(routes)


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers',
                         'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods',
                         'GET,PUT,POST,DELETE,OPTIONS')
    return response


@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """
    Run complete analysis pipeline: normalization + PCA

    Request body:
    {
        "normalization": "zscore",  // zscore, log2, quantile, robust
        "pca_components": 2,
        "variance_threshold": 0.01
    }
    """
    try:
        if analysis_service.data is None:
            return jsonify({'error': 'No data uploaded'}), 400

        # Get configuration from request
        config = request.get_json() or {}
        normalization = config.get('normalization', 'zscore')
        pca_components = config.get('pca_components', 2)
        variance_threshold = config.get('variance_threshold', 0.01)

        start_time = time.time()

        print(f"Starting analysis with config: {config}")

        # Step 1: Normalize data
        analysis_service.normalize_data(method=normalization)
        print("Normalization complete")

        # Step 2: Apply PCA
        analysis_service.apply_pca(
            n_components=pca_components,
            variance_threshold=variance_threshold
        )

        print("PCA complete")

        # Step 3: Compile results
        results = analysis_service.get_analysis_results()
        print("results compiled")

        processing_time = time.time() - start_time
        results['stats']['processing_time'] = f"{processing_time:.1f}s"
        results['stats']['normalization_method'] = normalization

        # Right before the return statement in analyze_data():
        print(f"Returning {len(results['pca_data'])} data points")
        print(f"Sample data point: {
              results['pca_data'][0] if results['pca_data'] else 'None'}")
        return jsonify({
            'status': 'success',
            'results': results
        })

    except Exception as e:
        import traceback
        print("ERROR in analyze_data:")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Automated Assay Analysis & Visualization API")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET  /api/health          - Health check")
    print("  POST /api/upload          - Upload gene expression data")
    print("  POST /api/analyze         - Run analysis pipeline")
    print("  GET  /api/export          - Export PCA results")
    print("  GET  /api/config          - Get configuration options")
    print("\nStarting server on http://localhost:5000")
    print("=" * 60)

    app.run(debug=True, host='0.0.0.0', port=5000)
