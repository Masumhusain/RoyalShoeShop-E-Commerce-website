 async function refreshStats() {
            const refreshBtn = document.getElementById('refreshStatsBtn');
            
            // Show loading state
            refreshBtn.classList.add('loading');
            
            try {
                const response = await fetch('/admin/api/stats');
                const data = await response.json();
                
                if (data.success) {
                    // Update stats on page
                    updateStats(data.stats);
                    
                    // Show success alert
                    showAlert('Statistics refreshed successfully!', 'success');
                } else {
                    throw new Error(data.error || 'Failed to refresh stats');
                }
            } catch (error) {
                console.error('Error refreshing stats:', error);
                showAlert('Error refreshing statistics: ' + error.message, 'danger');
            } finally {
                // Hide loading state
                refreshBtn.classList.remove('loading');
                updateTimestamp();
            }
        }