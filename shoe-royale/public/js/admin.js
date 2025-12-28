// Admin Panel JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Initialize DataTables
    const dataTables = document.querySelectorAll('.data-table');
    if (dataTables.length > 0) {
        dataTables.forEach(table => {
            $(table).DataTable({
                pageLength: 10,
                responsive: true,
                order: [[0, 'desc']],
                language: {
                    search: "_INPUT_",
                    searchPlaceholder: "Search..."
                }
            });
        });
    }
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    const popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
    
    // Confirm delete actions
    const deleteButtons = document.querySelectorAll('.btn-delete, .delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
    
    // Auto-dismiss alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
    
    // Update time in footer
    function updateTime() {
        const timeElement = document.querySelector('.time-update');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString();
        }
    }
    
    setInterval(updateTime, 60000);
    
    // Chart initialization
    const salesChartCanvas = document.getElementById('salesChart');
    if (salesChartCanvas) {
        const salesData = JSON.parse(salesChartCanvas.dataset.sales || '[]');
        
        const labels = salesData.map(item => item._id);
        const sales = salesData.map(item => item.totalSales);
        
        new Chart(salesChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Sales ($)',
                    data: sales,
                    borderColor: 'rgb(255, 215, 0)',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Stats Chart
    const statsChartCanvas = document.getElementById('statsChart');
    if (statsChartCanvas) {
        const statsData = JSON.parse(statsChartCanvas.dataset.stats || '{}');
        
        new Chart(statsChartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Products', 'Orders', 'Users', 'Revenue'],
                datasets: [{
                    data: [
                        statsData.totalProducts || 0,
                        statsData.totalOrders || 0,
                        statsData.totalUsers || 0,
                        Math.round(statsData.totalRevenue || 0)
                    ],
                    backgroundColor: [
                        '#4e54c8',
                        '#11998e',
                        '#ff416c',
                        '#ffd700'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }
    
    // Export functionality
    const exportButtons = document.querySelectorAll('.export-btn');
    exportButtons.forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            const url = `/admin/export/${type}`;
            window.open(url, '_blank');
        });
    });
    
    // Bulk actions
    const selectAllCheckbox = document.querySelector('.select-all');
    const itemCheckboxes = document.querySelectorAll('.item-checkbox');
    const bulkActionForm = document.querySelector('.bulk-action-form');
    const bulkActionSelect = document.querySelector('.bulk-action-select');
    
    if (selectAllCheckbox && itemCheckboxes.length > 0) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            itemCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
        
        if (bulkActionForm && bulkActionSelect) {
            bulkActionForm.addEventListener('submit', function(e) {
                const selectedItems = Array.from(itemCheckboxes).filter(cb => cb.checked);
                const action = bulkActionSelect.value;
                
                if (selectedItems.length === 0) {
                    e.preventDefault();
                    alert('Please select at least one item.');
                    return;
                }
                
                if (!action) {
                    e.preventDefault();
                    alert('Please select an action.');
                    return;
                }
                
                if (action.includes('delete') && !confirm(`Are you sure you want to ${action} ${selectedItems.length} item(s)?`)) {
                    e.preventDefault();
                }
            });
        }
    }
    
    // Search functionality
    const searchForm = document.querySelector('.search-form');
    const searchInput = document.querySelector('.search-input');
    
    if (searchForm && searchInput) {
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                if (this.value.length >= 2 || this.value.length === 0) {
                    searchForm.submit();
                }
            }, 500);
        });
    }
    
    // Image upload preview
    const imageUploads = document.querySelectorAll('.image-upload');
    imageUploads.forEach(upload => {
        upload.addEventListener('change', function() {
            const previewId = this.dataset.preview;
            const preview = document.getElementById(previewId);
            
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    if (preview) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                }
                
                reader.readAsDataURL(this.files[0]);
            }
        });
    });
    
    // Color picker
    const colorInputs = document.querySelectorAll('.color-picker');
    colorInputs.forEach(input => {
        const picker = document.createElement('div');
        picker.className = 'color-picker-preview';
        picker.style.cssText = `
            width: 30px;
            height: 30px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
            background-color: ${input.value};
            cursor: pointer;
            margin-right: 10px;
        `;
        
        input.parentNode.insertBefore(picker, input);
        
        picker.addEventListener('click', function() {
            input.click();
        });
        
        input.addEventListener('input', function() {
            picker.style.backgroundColor = this.value;
        });
    });
});

// Show notification
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Toggle password visibility
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Confirm and submit
function confirmAndSubmit(formId, message = 'Are you sure?') {
    if (confirm(message)) {
        document.getElementById(formId).submit();
    }
}

// Copy to clipboard
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const original = element.innerHTML;
        element.innerHTML = '<i class="fas fa-check"></i> Copied!';
        element.classList.add('text-success');
        
        setTimeout(() => {
            element.innerHTML = original;
            element.classList.remove('text-success');
        }, 2000);
    });
}