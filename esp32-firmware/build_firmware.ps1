$env:IDF_PYTHON_ENV_PATH = "C:\Users\User\.espressif\python_env\idf5.5_py3.11_env"
$env:IDF_PATH = "F:\.espressif\v5.5.5\esp-idf"
$env:PATH = "C:\Espressif\tools\xtensa-esp-elf\esp-14.2.0_20260121\xtensa-esp-elf\bin;C:\Espressif\tools\cmake\3.30.2\bin;C:\Espressif\tools\ninja\1.12.1;C:\Users\User\.espressif\python_env\idf5.5_py3.11_env\Scripts;C:\Espressif\tools\idf-exe\1.0.3;C:\Espressif\tools\ccache\4.12.1\ccache-4.12.1-windows-x86_64;" + $env:PATH

python "F:\.espressif\v5.5.5\esp-idf\tools\idf.py" @args

