from setuptools import setup, find_packages

setup(
    name="dynep",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.0",
    ],
    author="Dynep Data Intelligence",
    author_email="keys@dynep.com",
    description="Python client for Dynep Real-Time Cloud GPU Spot Pricing & Arbitrage API",
    url="https://data.dynep.com",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
    ],
)
