import subprocess
import os
import json
from pathlib import Path

class KMeansRunner:
    """Handles execution of the C kmeans clustering executable"""
    
    def __init__(self):
        base_dir = Path(__file__).resolve().parent  # backend/services/

        project_root = base_dir.parent.parent       # go to root

        self.executable_path = project_root / "c_core" / "bin" / "kmeans"
        self.elbow_executable_path = project_root / "c_core" / "bin" / "elbow"
        
    def run_clustering(self, input_file, output_file, k=3, max_iterations=100, num_threads=4):
        """
        Execute the C kmeans executable with given parameters
        
        Args:
            input_file (str): Path to input CSV file
            output_file (str): Path to output JSON file
            k (int): Number of clusters (default: 3)
            max_iterations (int): Maximum iterations for kmeans (default: 100)
            
        Returns:
            dict: Result with status and output or error message
        """
        try:
            # Check if executable exists
            if not os.path.exists(self.executable_path):
                return {
                    "success": False,
                    "error": f"Executable not found at {self.executable_path}" 
                }
            
            # Check if input file exists
            if not os.path.exists(input_file):
                return {
                    "success": False,
                    "error": f"Input file not found: {input_file}"
                }
            
            # Build command
            cmd = [
                self.executable_path,
                input_file,
                output_file,
                str(k),
                str(max_iterations),
                str(num_threads)
            ]
            
            # Execute the C program
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            # Check if execution was successful
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"C program failed: {result.stderr}"
                }
            
            # Verify output file was created
            if not os.path.exists(output_file):
                return {
                    "success": False,
                    "error": f"Output file was not created: {output_file}"
                }
            
            return {
                "success": True,
                "output_file": output_file,
                "message": result.stdout
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Clustering process timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }

    def run_elbow(self, input_file, output_file, k_max=10, max_iterations=100, num_threads=4):
        """
        Run elbow helper: WCSS for k = 1 .. k_max on the given numeric CSV.
        """
        try:
            if not os.path.exists(self.elbow_executable_path):
                return {
                    "success": False,
                    "error": f"Elbow executable not found at {self.elbow_executable_path}",
                }

            if not os.path.exists(input_file):
                return {
                    "success": False,
                    "error": f"Input file not found: {input_file}",
                }

            cmd = [
                str(self.elbow_executable_path),
                input_file,
                output_file,
                str(k_max),
                str(max_iterations),
                str(num_threads),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
            )

            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Elbow program failed: {result.stderr or result.stdout}",
                }

            if not os.path.exists(output_file):
                return {
                    "success": False,
                    "error": f"Elbow output was not created: {output_file}",
                }

            return {"success": True, "output_file": output_file}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Elbow process timed out"}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}
