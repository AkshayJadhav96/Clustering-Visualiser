import subprocess
import os
import json
from pathlib import Path

class KMeansRunner:
    """Handles execution of the C kmeans clustering executable"""
    
    def __init__(self, c_executable_path="./c_core/src/kmeans"):
        self.executable_path = c_executable_path
        
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
